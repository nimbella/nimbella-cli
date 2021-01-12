/*
 * Copyright (c) 2019 - present Nimbella Corp.
 *
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { StorageProvider, StorageClient, RemoteFile, DeleteFilesOptions, DownloadOptions, GetFilesOptions, SaveOptions, 
	SignedUrlOptions, UploadOptions, StorageKey, SettableFileMetadata, WebsiteOptions, FileMetadata } 
	from '@nimbella/storage-provider'
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsCommand, DeleteObjectCommand, DeleteObjectsCommand, 
	PutBucketWebsiteCommand, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Readable, Writable } from 'stream'
import { createWriteStream, createReadStream } from 'fs'
import { WritableStream } from 'memory-streams'
import * as makeDebug from 'debug'
const debug = makeDebug('nim:storage-s3')
import * as URL from 'url-parse'
 
class S3RemoteFile implements RemoteFile {
	private s3: S3Client
	private bucketName: string
	private web: boolean
	name: string

    constructor(s3: S3Client, bucketName: string, fileName: string, web: boolean) {
		debug('created file handle for %s', fileName)
		this.s3 = s3
		this.bucketName = bucketName
		this.name = fileName
		this.web = web
	}

	getImplementation(): any {
		return this.s3
	}

	save(data: Buffer, options?: SaveOptions): Promise<any> {
		// Set public read iff web bucket
		const ACL = this.web ? 'public-read' : undefined
		const cmd = new PutObjectCommand({ Bucket: this.bucketName, Key: this.name, Body: data, 
			ContentType: options?.metadata?.contentType, CacheControl: options?.metadata?.cacheControl, ACL })
		return this.s3.send(cmd)
	}

	setMetadata(meta: SettableFileMetadata): Promise<any> {
		const CopySource = `${this.bucketName}/${this.name}`
		const { cacheControl: CacheControl, contentType: ContentType } = meta
		const cmd = new CopyObjectCommand({ CopySource, Bucket: this.bucketName, Key: this.name, CacheControl, ContentType, MetadataDirective: 'REPLACE' })
		return this.s3.send(cmd)
	}

    async getMetadata(): Promise<FileMetadata|undefined> {
		const cmd = new HeadObjectCommand({ Bucket: this.bucketName, Key: this.name})
		const response = await this.s3.send(cmd)
		const { StorageClass: storageClass, ContentLength, ETag: etag, LastModified } = response
		return { name: this.name, storageClass, size: String(ContentLength), etag, updated: LastModified.toISOString() } 
	}

	async exists(): Promise<boolean> {
		return !!await this.getMetadata()
	}
	
    delete(): Promise<any> {
		const cmd = new DeleteObjectCommand({Bucket: this.bucketName, Key: this.name })
		return this.s3.send(cmd)
	}
	
	async download(options?: DownloadOptions): Promise<Buffer> {
		const destination = options?.destination ? createWriteStream(options.destination) : 
			new WritableStream({ highWaterMark: 1024 * 1024 })
		debug('download: created destination for options %O', options)
		const cmd = new GetObjectCommand({Bucket: this.bucketName, Key: this.name})
		debug('will send command: %O', cmd)
		const result = await this.s3.send(cmd)
		debug('got back result: %O', result)
		const content = result.Body as Readable // Body has type ReadableStream<any>|Readable|Blob.  Readable seems to work in practice
		debug('about to pipe')
		await pipe(content, destination)
		debug('piping complete')
		return options?.destination ? Buffer.from('') : (destination as WritableStream).toBuffer()
	}

	async getSignedUrl(options: SignedUrlOptions): Promise<string> {
		const { action, expires, version, contentType: ContentType } = options
		if (version !== 'v4') {
			throw new Error('Signing version v4 is required for s3')
		}
		let expiresIn: number
		if (expires) {
			// The interface expects something that can be passed to new Date()
			// to get an absolute time.  The s3 getSignedUrl options expect a value in seconds
			// from now
			expiresIn = (new Date(expires).getTime() - Date.now()) / 1000
		}
		let cmd
		switch (action) {
		case 'read':
			cmd = new GetObjectCommand({ Bucket: this.bucketName, Key: this.name })
			break
		case 'write':
			cmd = new PutObjectCommand({ Bucket: this.bucketName, Key: this.name, ContentType })
			break
		case 'delete':
			cmd = new DeleteObjectCommand({ Bucket: this.bucketName, Key: this.name })
		}
		if (!cmd) {
			throw new Error(`The action for a signed URL must be one of 'read' | 'write' | 'delete'`)
		}
		return getSignedUrl(this.s3, cmd, { expiresIn })
	}
 }

function pipe(input: Readable, output: Writable): Promise<unknown> {
	const toWait = new Promise(function(resolve) {
    	output.on('close', () => {
	      	resolve(true)
    	})
    	output.on('finish', () => {
	      	resolve(true)
    	})
	})
	input.pipe(output)
	return toWait
 }

 class NimS3Client implements StorageClient {
	private s3: S3Client
	private bucketName: string
	private url: string // defined iff web
	 
	constructor(s3: S3Client, bucketName: string, url: string) {
		debug('s3client: %O, bucketName=%s, url=%s', s3.config, bucketName, url)
		this.s3 = s3
		this.bucketName = bucketName
		this.url = url
	}

	getImplementation(): any {
		return this.s3
	}

    getURL(): string {
		return this.url
	}
	
	setWebsite(website: WebsiteOptions): Promise<any> {
		const { notFoundPage: Key, mainPageSuffix: Suffix } = website
		const cmd = new PutBucketWebsiteCommand({ Bucket: this.bucketName, WebsiteConfiguration: { ErrorDocument: { Key }, IndexDocument: { Suffix } }})
		return this.s3.send(cmd)
	}

	async deleteFiles(options?: DeleteFilesOptions): Promise<any> {
		// s3 does not support 'prefix' on DeleteObjects, only on ListObjects.
		// The multi-object delete takes a list of objects.  So this takes two round trips.
		const listCmd = new ListObjectsCommand({ Bucket: this.bucketName, Prefix: options?.prefix })
		const listResult = await this.s3.send(listCmd)
		if (!listResult.Contents) {
			return true
		}
		const Objects = listResult.Contents.map(obj => ({ Key: obj.Key }))
		const deleteCmd = new DeleteObjectsCommand({ Bucket: this.bucketName, Delete: { Objects } })
		return this.s3.send(deleteCmd)
	}

	file(destination: string): RemoteFile {
		return new S3RemoteFile(this.s3, this.bucketName, destination, !!this.url)
	}

	upload(path: string, options?: UploadOptions): Promise<any> {
		const data = createReadStream(path)
		const Key = options?.destination || path
		// Set public read iff web bucket
		const ACL = this.url ? 'public-read' : undefined
		const cmd = new PutObjectCommand({ Bucket: this.bucketName, Key, ContentType: options?.metadata?.contentType,
			CacheControl: options?.metadata?.cacheControl, Body: data, ACL })
		return this.s3.send(cmd)
	}

	async getFiles(options?: GetFilesOptions): Promise<RemoteFile[]> {
		const cmd = new ListObjectsCommand({ Bucket: this.bucketName, Prefix:options?.prefix })
		const response = await this.s3.send(cmd)
		return (response.Contents || []).map(obj => new S3RemoteFile(this.s3, this.bucketName, obj.Key, !!this.url))
	}
 }

// Compute the actual name of a bucket, minus the s3:// prefix.
// These need to be unique.  This probably needs more work.
function computeBucketStorageName(apiHost: string, namespace: string): string {
  return namespace + '-nimbella-io'
}

// Compute a possibly adequate website URL when none is provided in the credentials.
// The algorithm here works on one test installation (using scality ring) but is not likely
// to yield the best URL in general.  Making a URL part of the credentials is expected
// to be the case for most installations.
function computeBucketUrl(endpoint: string, namespace: string): string {
	const url = new URL(endpoint)
	return `http://${namespace}-nimbella-io.${url.hostname}`
}

const provider: StorageProvider = {
	prepareCredentials: (original: Record<string, any>): StorageKey => {
		// For s3 we will arrange to have the stored information be exactly what we need so
		// this function is an identity map
		return original as StorageKey
	},
	getClient: (namespace: string, apiHost: string, web: boolean, credentials: Record<string, any>) => {
		const s3 = new S3Client(credentials)
		// The following is a recommended workaround for https://github.com/aws/aws-sdk-js-v3/issues/1800
		s3.middlewareStack.add(
  			(next) => async (args: any) => {
    			delete args.request.headers['content-type']
    			return next(args)
  			},
  			{step: 'build'})
		let bucketName = computeBucketStorageName(apiHost, namespace)
		let url: string
		if (web) {
			url = credentials.weburl || computeBucketUrl(credentials.endpoint, namespace)
		} else {
			bucketName = 'data-' + bucketName
		}
		return new NimS3Client(s3, bucketName, url)
	}
}

export default provider
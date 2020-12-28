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

import { StorageProvider, StorageClient, RemoteFile, DeleteFilesOptions, DownloadOptions, GetFilesOptions,
	SaveOptions, SignedUrlOptions, UploadOptions, StorageKey } from '@nimbella/storage-provider'
import { S3, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { Readable, Writable } from 'stream'
import { createWriteStream } from 'fs'
import { WritableStream } from 'memory-streams'
import * as makeDebug from 'debug'
const debug = makeDebug('nim:storage-s3')
 
class S3RemoteFile implements RemoteFile {
	private s3: S3
	private bucketName: string
	name: string

    constructor(s3: S3, bucketName: string, fileName: string) {
		debug('created file handle for %s', fileName)
		this.s3 = s3
		this.bucketName = bucketName
		this.name = fileName
	}

	getImplementation(): any {
		return this.s3
	}

	save(data: Buffer, options?: SaveOptions): Promise<any> {
		const cmd = new PutObjectCommand({Bucket: this.bucketName, Key: this.name, Body: data, Metadata: options?.metadata })
		return this.s3.send(cmd)
	}

	setMetadata(meta: Record<string, any>): Promise<any> {
		return undefined
	}

    async getMetadata(): Promise<Record<string, any>> {
    	return undefined
	}

	async exists(): Promise<boolean> {
		return undefined
	}
	
    delete(): Promise<any> {
		return undefined
	}
	
	async download(options?: DownloadOptions): Promise<Buffer> {
		const destination = options?.destination ? createWriteStream(options.destination) : 
			new WritableStream({ highWaterMark: 1024 * 1024 })
		debug('download: created destination for options %O', options)
		const cmd = new GetObjectCommand({Bucket: this.bucketName, Key: this.name})
		debug('will send command: %O', cmd)
		const result = await this.s3.send(cmd)
		debug('got back result: %O', result)
		const content = result.Body as Readable // TODO what if Body isn't a Readable?
		debug('about to pipe')
		await pipe(content, destination)
		debug('piping complete')
		return options?.destination ? Buffer.from('') : (destination as WritableStream).toBuffer()
	}

	async getSignedUrl(options?: SignedUrlOptions): Promise<string> {
		return undefined
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

 class S3Client implements StorageClient {
	private s3: S3
	private bucketName: string
	private url: string
	 
	constructor(s3: S3, bucketName: string, url: string) {
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
	
	setMetadata(meta: Record<string, any>): Promise<any> {
		return undefined
	}

	deleteFiles(options?: DeleteFilesOptions): Promise<any> {
		return undefined
	}

	file(destination: string): RemoteFile {
		return new S3RemoteFile(this.s3, this.bucketName, destination)
	}

	upload(path: string, options?: UploadOptions): Promise<any> {
		return undefined
	}

	async getFiles(options?: GetFilesOptions): Promise<RemoteFile[]> {
		return undefined
	}
 }

// Compute the actual name of a bucket, minus the s3:// prefix.
// These need to be unique.  This probably needs more work.
function computeBucketStorageName(apiHost: string, namespace: string): string {
  return namespace + '-nimbella-io'
}

// Compute the external domain name corresponding to a web bucket
function computeBucketDomainName(apiHost: string, namespace: string): string {
	// There is no general answer for s3 ... it is going to depend on the installation
	// This may have to be pluggable in some way
	return undefined
}

const provider: StorageProvider = {
	prepareCredentials: (original: Record<string, any>): StorageKey => {
		// For s3 we will arrange to have the stored information be exactly what we need so
		// this function is an identity map
		return original as StorageKey
	},
	getClient: (namespace: string, apiHost: string, web: boolean, credentials: Record<string, any>) => {
		const s3 = new S3(credentials)
		let bucketName = computeBucketStorageName(apiHost, namespace)
		let url: string
		if (web) {
			url = "https://" + computeBucketDomainName(apiHost, namespace)
		} else {
			bucketName = 'data-' + bucketName
		}
		return new S3Client(s3, bucketName, url)
	}
}

export default provider
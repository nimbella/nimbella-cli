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

import { StorageProvider, StorageClient, RemoteFile } from 'nimbella-deployer'
import { Storage, Bucket, File, GetSignedUrlConfig } from '@google-cloud/storage'
import * as URL from 'url-parse'
 
 class GCSRemoteFile implements RemoteFile {
	 private file: File

	 constructor(file: File) {
		 this.file = file
	 }

	 getImplementation(): any {
		 return this.file
	 }

	 save( data: Buffer, options: Record<string, any>): Promise<any> {
		 return this.file.save(data, options)
	 }

	 setMetadata(meta: Record<string, any>): Promise<any> {
		 return this.file.setMetadata(meta)
	 }

    async getMetadata(): Promise<Record<string, any>> {
		const data = await this.file.getMetadata()
		return data[0]
	}

	async exists(): Promise<boolean> {
		const ans = await this.file.exists()
		return ans[0]
	}
	
    delete(): Promise<any> {
		return this.file.delete()
	}
	
	async download(options?: Record<string, any>): Promise<Buffer> {
		const response = await this.file.download(options)
		return response[0]
	}

	async getSignedUrl(options?: Record<string, any>): Promise<string> {
		const result = await this.file.getSignedUrl(options as GetSignedUrlConfig)
		return result[0]
	}
 }

 class GCSClient implements StorageClient {
	private bucket: Bucket
	private url: string
	 
	constructor(bucket: Bucket, url: string) {
		this.bucket = bucket
		this.url = url
	}

	getImplementation(): any {
		return this.bucket
	}

    getURL(): string {
		return this.url
	}
	
	setMetadata(meta: Record<string, any>): Promise<any> {
		return this.bucket.setMetadata(meta)
	}

	deleteFiles(options?: Record<string, any>): Promise<any> {
		return this.deleteFiles(options)
	}

	file(destination: string): RemoteFile {
		return new GCSRemoteFile(this.bucket.file(destination))
	}

	upload(path: string, options?: Record<string, any>): Promise<any> {
		return this.bucket.upload(path, options)
	}

	async getFiles(options?: Record<string, any>): Promise<RemoteFile[]> {
		const files = (await this.bucket.getFiles(options))[0]
		return files.map(file => new GCSRemoteFile(file))
	}
 }

// Compute the actual name of a bucket as viewed by google storage
function computeBucketStorageName(apiHost: string, namespace: string): string {
  return computeBucketDomainName(apiHost, namespace).split('.').join('-')
}

// Compute the external domain name corresponding to a web bucket
function computeBucketDomainName(apiHost: string, namespace: string): string {
  const url = URL(apiHost)
  return namespace + '-' + url.hostname
}

const provider: StorageProvider = {
	getClient: (namespace: string, apiHost: string, web: boolean, credentials: Record<string, any>) => {
		const storage: Storage = new Storage(credentials)
		let bucketName = computeBucketStorageName(apiHost, namespace)
		let url: string
		if (web) {
			url = computeBucketDomainName(apiHost, namespace)
		} else {
			bucketName = 'data-' + bucketName
		}
		const bucket = storage.bucket(bucketName)
		return new GCSClient(bucket, url)
	},
	getImplementation: () => null 
}

export default provider
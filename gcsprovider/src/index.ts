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

 import { StorageClient } from 'nimbella-deployer'
 import { Storage, Bucket, File, GetSignedUrlConfig } from '@google-cloud/storage'
 import { RemoteFile } from 'nimbella-deployer'

 class GCSRemoteFile implements RemoteFile {
	 private file: File

	 constructor(file: File) {
		 this.file = file
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
	 
	constructor(bucket: Bucket) {
		this.bucket = bucket
		this.name = bucket.name
	}

	name: string

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

 export function makeClient(bucketName: string, options: Record<string,any>): StorageClient {
	const storage: Storage = new Storage(options)
	const bucket = storage.bucket(bucketName)
	return new GCSClient(bucket)
 }
 
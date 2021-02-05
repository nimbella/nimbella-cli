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

import {
  StorageProvider, StorageClient, RemoteFile, DeleteFilesOptions, DownloadOptions, GetFilesOptions,
  SaveOptions, SignedUrlOptions, UploadOptions, StorageKey, FileMetadata, WebsiteOptions, SettableFileMetadata
} from '@nimbella/storage-provider'
import { Storage, Bucket, File, GetSignedUrlConfig } from '@google-cloud/storage'
import * as URL from 'url-parse'

class GCSRemoteFile implements RemoteFile {
   private file: File
   name: string

   constructor(file: File) {
     this.file = file
     this.name = file.name
   }

   getImplementation(): any {
     return this.file
   }

   save(data: Buffer, options: SaveOptions): Promise<any> {
     return this.file.save(data, options)
   }

   setMetadata(meta: SettableFileMetadata): Promise<any> {
     return this.file.setMetadata(meta)
   }

   async getMetadata(): Promise<FileMetadata> {
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

   async download(options?: DownloadOptions): Promise<Buffer> {
     const response = await this.file.download(options)
     return response[0]
   }

   async getSignedUrl(options: SignedUrlOptions): Promise<string> {
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

  setWebsite(website: WebsiteOptions): Promise<any> {
    return this.bucket.setMetadata({ website })
  }

  deleteFiles(options?: DeleteFilesOptions): Promise<any> {
    return this.bucket.deleteFiles(options)
  }

  file(destination: string): RemoteFile {
    return new GCSRemoteFile(this.bucket.file(destination))
  }

  upload(path: string, options?: UploadOptions): Promise<any> {
    return this.bucket.upload(path, options)
  }

  async getFiles(options?: GetFilesOptions): Promise<RemoteFile[]> {
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
  prepareCredentials: (original: Record<string, any>): StorageKey => {
    const { client_email, private_key, project_id } = original
    return { credentials: { client_email, private_key }, project_id, provider: '@nimbella/storage-gcs' }
  },
  getClient: (namespace: string, apiHost: string, web: boolean, credentials: Record<string, any>) => {
    const storage: Storage = new Storage(credentials)
    let bucketName = computeBucketStorageName(apiHost, namespace)
    let url: string
    if (web) {
      url = 'https://' + computeBucketDomainName(apiHost, namespace)
    } else {
      bucketName = 'data-' + bucketName
    }
    const bucket = storage.bucket(bucketName)
    return new GCSClient(bucket, url)
  }
}

export default provider

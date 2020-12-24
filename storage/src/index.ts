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

// The top-level signature of a storage provider
export interface StorageProvider {
    getClient: (namespace: string, apiHost: string, web: boolean, credentials: Record<string, any>) => StorageClient
}

// The behaviors required of a storage client (part of storage provider)
export interface StorageClient {
    getURL: () => string
    setMetadata: (meta: Record<string, any>) => Promise<any>
    deleteFiles: (options?: Record<string, any>) => Promise<any>
    upload: (path: string, options?: Record<string, any>) => Promise<any>
    file: (destination: string) => RemoteFile
    getFiles: (options?: Record<string, any>) => Promise<RemoteFile[]>
    getImplementation: () => any        
}

// The behaviors required of a file handle (part of storage provider)
export interface RemoteFile {
    name: string
    save: (data: Buffer, options: Record<string, any>) => Promise<any>
    setMetadata: (meta: Record<string, any>) => Promise<any>
    getMetadata: () => Promise<Record<string, any>>
    exists: () => Promise<boolean>
    delete: () => Promise<any>
    download: (options?: Record<string, any>) => Promise<Buffer>
    getSignedUrl: (options?: Record<string, any>) => Promise<string>
    getImplementation: () => any
}

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

 // Model the StorageKey type that is to be stored in the credential store.  Only the 'provider' member has specified
 // semantics.  The rest is at the convenience of the provider.
export type StorageKey = {
        provider?: string  // Assume '@nimbella/storage-gcs' if omitted
    } & {
        [prop: string]: any
    }

// Options that may be passed to deleteFiles
export interface DeleteFilesOptions {
    force?: boolean
    prefix?: string
}

// Options that may be passed to upload
export interface UploadOptions {
    destination?: string
    gzip?: boolean
    metadata?: SettableFileMetadata
}

// Options that may be passed to getFiles
export interface GetFilesOptions {
    prefix?: string
}

// Options that may be passed to save
export interface SaveOptions {
    metadata?: SettableFileMetadata
}

// Options that may be passed to download
export interface DownloadOptions {
    destination?: string
}

// Options that may be passed to getSignedUrl
export interface SignedUrlOptions {
    version: 'v2' | 'v4'
    action: 'read' | 'write' | 'delete'
    expires: number
    contentType?: string
}

// Options for setting website characteristics
export interface WebsiteOptions {
    mainPageSuffix?: string
    notFoundPage?: string
}

// Per object (file) metadata
export interface FileMetadata {
    name: string
    storageClass: string
    size: string
    etag: string
    updated: string
}

// Metadata that can be set on a file
export interface SettableFileMetadata {
    contentType?: string
    cacheControl?: string
}

// The top-level signature of a storage provider
export interface StorageProvider {
    // Provide the appropriate client handle for accessing a type file store (web or data) in a particular namespace
    getClient: (namespace: string, apiHost: string, web: boolean, credentials: StorageKey) => StorageClient
    // Convert an object containing credentials as stored in couchdb into the proper form for the credential store
    // Except for GCS, which is grandfathered as the default, the result must include a 'provider' field denoting
    // a valid npm-installable package
    prepareCredentials: (original: Record<string,any>) => StorageKey
}

// The behaviors required of a storage client (part of storage provider)
export interface StorageClient {
    // Get the root URL if the client is for web storage (return falsey for data storage)
    getURL: () => string
    // Set website information
    setWebsite: (website: WebsiteOptions) => Promise<any>
    // Delete files from the store
    deleteFiles: (options?: DeleteFilesOptions) => Promise<any>
    // Add a local file (specified by path)
    upload: (path: string, options?: UploadOptions) => Promise<any>
    // Obtain a file handle in the store.  The file may or may not exist
    file: (destination: string) => RemoteFile
    // Get files from the store
    getFiles: (options?: GetFilesOptions) => Promise<RemoteFile[]>
    // Get the underlying implementation for provider-dependent operations
    getImplementation: () => any        
}

// The behaviors required of a file handle (part of storage provider)
export interface RemoteFile {
    // The name of the file
    name: string
    // Save data into the file
    save: (data: Buffer, options: SaveOptions) => Promise<any>
    // Set the file metadata
    setMetadata: (meta: SettableFileMetadata) => Promise<any>
    // Get the file metadata
    getMetadata: () => Promise<FileMetadata>
    // Test whether file exists
    exists: () => Promise<boolean>
    // Delete the file
    delete: () => Promise<any>
    // Obtain the contents of the file
    download: (options?: DownloadOptions) => Promise<Buffer>
    // Get a signed URL to the file
    getSignedUrl: (options: SignedUrlOptions) => Promise<string>
    // Get the underlying implementation for provider-dependent operations
    getImplementation: () => any
}

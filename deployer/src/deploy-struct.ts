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

import { Dict, Client, Limits, KeyVal as OWKeyVal } from 'openwhisk'
import { StorageClient } from '@nimbella/storage'

// Contains the primary type definition for the deployer structure.
// The structure consists of the contents of a 'project' (its file and folder structure) along
// with the contents of a distinguished config file in the root of the project, if present.

// The substructure for a web resource.
export interface WebResource {
    // The name of the resource relative to the web directory.  Used as a key when merging a WebResource in the config
    // with one constructed from the project contents.  For action-wrapping, the simpleName must be simple (no slashes).
    // For bucket deployment all valid path names are accepted.
    simpleName: string
    // The complete path to the resource within the project, for reading and deployment.  This is computed from the
    // simpleName once the project location is known and should not be specified in the config.
    filePath?: string
    // The mime-type of the resource (generally inferred from its extension but can be specified explicitly in the config)
    // The mime-type is only required when action-wrapping.
    mimeType?: string
    // Build information (not specifiable in the config)
    build?: string
}

// Describes one package containing zero or more actions
export interface PackageSpec {
    name: string // The 'default' package is used to hold actions with no package.  Only the 'actions' member is processed then.
    actions?: ActionSpec[]
    shared: boolean // Indicates that the package is intended to be shared (public)
    annotations?: Dict // package annotations
    parameters?: Dict // Bound parameters for all actions in the package, passed in the usual way
    environment?: Dict // Bound parameters for all actions in the package, destined to go in the environment of each action
    clean?: boolean // Indicates that the package is to be deleted (with its contained actions) before deployment
    web?: any // like 'web' on an action but affects all actions of the package that don't redeclare the flag
}

// Describes one action
export interface ActionSpec {
    name: string // The name of the action
    package?: string // The name of the package where action appears ('default' if no package)
    // The following are used to assemble 'exec'.  Currently, you can't specify exec directly
    file?: string // The path to the file comprising the action (possibly a zip file)
    displayFile?: string // The file path to display in messages
    code?: string // The code of the action (bypasses file reading; used internally; not specifiable in the config)
    runtime?: string // The runtime to use for the action
    main?: string // The 'main' directive if needed
    binary?: boolean // Indicates the need for base64 encoding
    zipped?: boolean // (Ignored unless binary) indicates that the binary object is a zip archive
    // End of 'exec' properties
    sequence?: string[] // Indicates that this action is a sequence and provides its components.  Mutually exclusive with the 'exec' options
    web?: any // like --web on the CLI; expands to multiple annotations.  Project reader assigns true unless overridden.
    webSecure?: any // like --web-secure on the CLI.  False unless overridden
    annotations?: Dict // 'web' and 'webSecure' are merged with what's here iff present
    parameters?: Dict // Bound parameters for the action passed in the usual way
    environment?: Dict // Bound parameters for the action destined to go in the environment
    limits?: Limits // Action limits (time, memory, logs)
    clean?: boolean // Indicates that an old copy of the action should be removed before deployment
    remoteBuild?: boolean // States that the build (if any) must be done remotely
    localBuild?: boolean // States that the build (if any) must be done locally (precludes a github deploy in the cloud)
    // Build information (not specifiable in the config)
    build?: string
    wrapping?: string
    buildResult?: string // The activation id of the remote build
    buildError?: Error // Error reported from the build step
}

// Information of various kinds typically specified on the command line
export interface Flags {
    verboseBuild: boolean
    verboseZip: boolean
    production: boolean
    incremental: boolean
    yarn: boolean
    env: string|undefined
    webLocal: string|undefined
    include: string|undefined
    exclude: string|undefined
    remoteBuild: boolean
}

// Provides the status of a shared build
export interface BuildStatus {
    pending: ((arg0: Error)=>void)[]
    built: boolean
    error: Error
}

// Map from shared build directories (absolute paths) to Promise chains representing steps dependent on those builds
export interface BuildTable {
    [ key: string]: BuildStatus
}

// Object to provide feedback (warnings and progress reports) in real time during execution.
// NOT for debugging.
// NOT for normal communication: summary messages should be fed back through DeployResponse
// NOT for hard errors: those should be thrown or Promise-rejected.
export interface Feedback {
    warn(message?: any, ...optionalParams: any[]): void
    progress(message?: any, ...optionalParams: any[]): void
}

export class DefaultFeedback implements Feedback {
  warn(message?: any, ...optionalParams: any[]): void {
    console.warn(message, ...optionalParams)
  }

  progress(message?: any, ...optionalParams: any[]): void {
    console.log(message, ...optionalParams)
  }
}

// The top-level deploy structure.  Nothing is required.  If the structure is vacuous, nothing is deployed.   This interface
// describes the syntax of project.yml and also the structure of a project on disk (where 'web' and 'packages') are
// subdirectories of the project).   The two sources of information are merged.
export interface DeployStructure {
    web?: WebResource[] // Resources found in the web directory
    packages?: PackageSpec[] // The packages found in the package directory
    targetNamespace?: string | Ownership // The namespace to which we are deploying.  An 'Ownership' implies ownership by the project
    cleanNamespace?: boolean // Clears entire namespace prior to deploying
    bucket?: BucketSpec // Information guiding deployment of web resources into an s3 (or s3-like) object store bucket
    actionWrapPackage?: string // The name of a package into which web resources will be action-wrapped.
    parameters?: Dict // Parameters to apply to all packages in the project
    environment?: Dict // Environment to apply to all packages in the project
    // The following fields are not documented for inclusion project.yml but may be present in a project slice config (remote build)
    // They are typically added internally.
    slice?: boolean // Labels this DeployStructure as belonging to a a project slice
    credentials?: Credentials // The full credentials for the deployment (consistent with targetNamespace if one was specified)
    flags? : Flags // options typically specified on the command line
    deployerAnnotation?: DeployerAnnotation // The deployer annotation to use (with the digest undefined, as it varies)
    // The following fields are never permitted in project.yml but are always added internally
    webBuild?: string // Type of build (build.sh or package.json) to apply to the web directory
    sharedBuilds?: BuildTable // The build table for this project, populated as shared builds are initiated
    strays?: string[] // files or directories found in the project that don't fit the model, not necessarily an error
    filePath?: string // The location of the project on disk
    githubPath?: string // The original github path specified, if deploying from github
    owClient?: Client // The openwhisk client for deploying actions and packages
    bucketClient?: StorageClient // The client for deploying to a bucket
    includer?: Includer // The 'includer' for deciding which packages, actions, web are included in the deploy
    reader?: ProjectReader // The project reader to use
    versions?: VersionEntry // The VersionEntry for credentials.namespace on the selected API host if available
    feedback?: Feedback // The object to use for immediate communication to the user (e.g. for warnings and progress reports)
    error?: Error // Records an error in reading or preparing, or a terminal error in building; the structure should not be used
    webBuildError?: Error // Indicates an error in building the web component; the structure is usable but the failure should be reported
    webBuildResult?: string // activation id of remote build
    sequences?: ActionSpec[] // detected during action deployment and deferred until ordinary actions are deployed
}

// Structure declaring ownership of the targetNamespace by this project.  Ownership is recorded only locally (in the credential store)
export interface Ownership {
    // Individually optional but at least one must be specified
    test?: string
    production?: string
}

// The specification of information guiding bucket deployment of web resources if that feature is to be employed
export interface BucketSpec {
    prefixPath?: string // A directory prefix used in front of every resource when deploying (if absent, / is assumed)
    strip?: number // The number of path segments to strip from every resource when deploying (before adding prefix path, if any)
    mainPageSuffix?: string // The suffix to append to any directory URL (including the bucket root) to form the URL of a web page (defaults to 'index.html')
    notFoundPage?: string // The name of a page (relative to the root) to show on 404 errors.
    clean?: boolean // Deletes existing content starting at prefixPath (or the root if no prefixPath) before deploying new content
    useCache?: boolean // If true, default cacheing (one hour) is enabled.  Otherwise a Cache-Control header of `no-cache` is set
    remoteBuild?: boolean // States that the build (if any) must be done remotely
    localBuild?: boolean // States that the build (if any) must be done locally (precludes a github deploy in the cloud)
 }

// Types used in the DeployResponse
export interface VersionInfo {
    version: string
    digest: string
}
export interface VersionMap {
    [key: string]: VersionInfo
}

export type DeployKind = 'web' | 'action'

export interface DeploySuccess {
    name: string
    kind: DeployKind
    skipped: boolean
    wrapping?: string
}

// Contains the responses from an actual deployment
export interface DeployResponse {
    successes: DeploySuccess[]
    failures: Error[]
    ignored: string[]
    namespace: string
    packageVersions: VersionMap
    actionVersions: VersionMap
    apihost?: string
    webHashes?: { [key: string]: string }
}

// Structure sent to the remote builder
// This declaration is taken directly from https://github.com/nimbella-corp/main/tree/master/builder/docs
// Most fields are irrelevant to deployer use.  I believe
//    'auth' is required in order to authenticate the request.
//    'code' will contain the zipped slice (how do I convey that this contains a zipped slice and not the legacy input to the builder?  Do I need to?)
//    'binary' will always be true
//    'kind' will be set to convey the runtime to use (must support pre-compile, which hopefully will be every runtime soon)
//    'action' may contain the action name but I don't expect it to be used since the builder shouldn't deploy slices itself.  Also, if
//      the slice is a web build, 'action' will be set to ''.
//    'main' and 'extra' will be unused (since `nim project deploy` will deploy the slice).   I will set them to empty strings.
export interface SliceRequest {
  value: {
    auth: string
    code: string
    binary: boolean
    main: string
    kind: string
    action: string
    extra: any
  }
}

// The version file entry for a given deployment
export interface VersionEntry {
    apihost: string
    namespace: string
    packageVersions: VersionMap
    actionVersions: VersionMap
    webHashes: { [key: string]: string }
}

// The annotation placed in every action and package deployed by the deployer
export interface DeployerAnnotation {
    repository?: string
    commit?: string
    digest: string
    projectPath: string
    user: string
    zipped?: boolean
}

// Grouping for OW Options that can be specified on the command line or by caller; also part of credential lookup response
export interface OWOptions {
    apihost?: string
    api_key?: string
    ignore_certs?: boolean
}

// Supporting types for oauth

// These types duplicate declarations in main/deployable/login, except that Credentials is renamed to FullCredentials
// to avoid confusing it with the Credentials type used through nim.
export type IdProvider = {
    provider: string
    name: string
    key: string
}

export type FullCredentials = {
    status: string
    apihost: string
    namespace: string
    uuid: string
    key: string
    redis: boolean
    storage?: string
    externalId?: IdProvider
}

// Format of the JSON file containing credential information, persisted in ~/.nimbella/credentials.json
export interface CredentialStore {
    currentHost: string
    currentNamespace: string
    credentials: CredentialHostMap
    currentGithub?: string
    github?: {[ key: string ]: string}
    currentPostman?: string
    postman?: {[ key: string ]: string}
}

export interface CredentialHostMap {
    [ key: string ]: CredentialNSMap // Keyed by API host
}

// Part of CredentialStore for a single API host
export interface CredentialNSMap {
    [ key: string ]: CredentialEntry // keyed by namespace relative to API host
}

// Part of CredentialStore for a single namespace relative to an API host.
// It describes the credentials owned by the user who owns ~/.
// While different subjects in couchdb can have different credentials to a shared namespace,
// we assume that a user keeps only one credential set for that namespace.
export interface CredentialEntry {
    api_key: string
    storageKey: any
    redis: boolean
    project?: string
    production?: boolean
    commander?: Record<string, unknown>
}

// The Result of a credential lookup
export interface Credentials {
    namespace: string|undefined
    ow: OWOptions
    storageKey: any
    redis: boolean
    project?: string
    production?: boolean
    commander?: Record<string, unknown>
}

// Compact and less complete information about a Credential suitable for listing and tabular display
export interface CredentialRow {
    namespace: string
    current: boolean
    storage: boolean
    redis: boolean
    project?: string
    production?: boolean
    apihost: string
}

// The Includer object is used during project reading and deployment to screen web, packages, and actions to be included
export interface Includer {
    isWebIncluded: boolean
    isPackageIncluded: (pkg: string, all: boolean) => boolean
    isActionIncluded: (pkg: string, action: string) => boolean
    isIncludingEverything: () => boolean
 }

// Defines the general ProjectReader interface

// A simplified fs.Dirent that just distinguishes files, directories, and symlinks.
// The symlink case is only for "dangling" symlinks: intact symlinks are followed.
export type PathKind = { name: string, isDirectory: boolean, isFile: boolean, symlink?: string, mode: number }

// The method repertoire for reading projects.
// Path names passed to these methods may, in the most general case, be either absolute or relative to the
// project root.  After canonicalizing `..` directives in such paths, they may point inside or outside the project.
// For the file system, we accept absolute paths and allow a relative path to land anywhere in the file system.
// For github we reject absolute paths ane require a relative path to land within the github repo that contains the project.
export interface ProjectReader {
    // Read the contents of a directory (non-recursively)
    readdir: (path: string) => Promise<PathKind[]>
    // Read the contents of a file (e.g. config, code, .include ...)
    readFileContents: (path: string) => Promise<Buffer>
    // Test whether a file exists
    isExistingFile: (path: string) => Promise<boolean>
    // Get the PathKind of a path
    getPathKind: (path: string) => Promise<PathKind>
    // Get the location of the project in a real file system (returns null for github)
    getFSLocation: () => string|null
}

// Define KeyVal for our purposes, supporting the `init` option for parameters
export interface KeyVal extends OWKeyVal {
    init?: boolean
}

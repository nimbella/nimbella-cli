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

// Gather together the major deployer exports for convenient import in other packages

export {
  initializeAPI, deployProject, readPrepareAndBuild, readAndPrepare, deploy, readProject, buildProject, prepareToDeploy,
  wipeNamespace, wipePackage, getUserAgent
} from './api'
export {
  DeployStructure, DeployResponse, DeploySuccess, OWOptions, Credentials, CredentialRow, Flags, PackageSpec, ActionSpec,
  CredentialHostMap, CredentialNSMap, DeployerAnnotation, VersionMap, Feedback, DefaultFeedback, FullCredentials, IdProvider
} from './deploy-struct'
export {
  StorageProvider, StorageClient, RemoteFile
} from '@nimbella/storage'
export { doLogin, doAdminLogin, doInteractiveLogin } from './login'
export {
  addCredentialAndSave, getCredentials, getCredentialList, getCredentialDict, getCredentialsForNamespace, forgetNamespace, switchNamespace, getCurrentNamespace,
  getApiHosts, Persister, fileSystemPersister, browserPersister, authPersister, addGithubAccount, getGithubAccounts, deleteGithubAccount, getGithubAuth, getCredentialsFromEnvironment,
  switchGithubAccount, getPostmanKeys, deletePostmanKey, switchPostmanKey, addPostmanKey, getPostmanCurrentKey, addCommanderData, recordNamespaceOwnership, nimbellaDir, setInBrowser
} from './credentials'
export { cleanBucket, restore404Page, makeStorageClient } from './deploy-to-bucket'
export { extFromRuntime, wskRequest, inBrowser, RuntimeTable, delay, writeSliceResult, getBestProjectName, isTextType, renamePackage, getExclusionList, isExcluded, SYSTEM_EXCLUDE_PATTERNS } from './util'
export { GithubDef, isGithubRef, parseGithubRef, fetchProject } from './github'
export { NimBaseCommand, NimLogger, parseAPIHost, NimFeedback, disambiguateNamespace, CaptureLogger } from './NimBaseCommand'
export { deleteSlice } from './slice-reader'

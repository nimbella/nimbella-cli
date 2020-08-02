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

export { initializeAPI, deployProject, readPrepareAndBuild, readAndPrepare, deploy, readProject, buildProject, prepareToDeploy,
    wipeNamespace, wipePackage } from './api'
export { DeployStructure, DeployResponse, DeploySuccess, OWOptions, Credentials, CredentialRow, Flags, PackageSpec, ActionSpec,
    CredentialHostMap, CredentialNSMap, DeployerAnnotation, VersionMap, Feedback, DefaultFeedback } from './deploy-struct'
export { doLogin, doAdminLogin } from './login'
export { addCredentialAndSave, getCredentials, getCredentialList, getCredentialsForNamespace, forgetNamespace, switchNamespace,
    Persister, fileSystemPersister, browserPersister, addGithubAccount, addCommanderData } from './credentials'
export { computeBucketStorageName, computeBucketDomainName, cleanBucket } from './deploy-to-bucket'
export { extFromRuntime } from './util'
export { GithubDef, isGithubRef, parseGithubRef, fetchProject } from './github'

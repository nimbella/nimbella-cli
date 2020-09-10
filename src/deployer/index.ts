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

// Re-export what nimbella-deployer exports.  This is mostly for backward compatibility.

export {
  initializeAPI, deployProject, readPrepareAndBuild, readAndPrepare, deploy, readProject, buildProject, prepareToDeploy,
  wipeNamespace, wipePackage, getUserAgent, // from './api'
  DeployStructure, DeployResponse, DeploySuccess, OWOptions, Credentials, CredentialRow, Flags, PackageSpec, ActionSpec,
  CredentialHostMap, CredentialNSMap, DeployerAnnotation, VersionMap, Feedback, DefaultFeedback, FullCredentials, IdProvider, // from './deploy-struct'
  doLogin, doAdminLogin, doInteractiveLogin, // from './login'
  addCredentialAndSave, getCredentials, getCredentialList, getCredentialDict, getCredentialsForNamespace, forgetNamespace, switchNamespace,
  getApiHosts, Persister, fileSystemPersister, browserPersister, authPersister, addGithubAccount, getGithubAccounts, deleteGithubAccount,
  getGithubAuth, switchGithubAccount, addCommanderData, recordNamespaceOwnership, nimbellaDir, setInBrowser, // from './credentials'
  computeBucketStorageName, computeBucketDomainName, cleanBucket, restore404Page, // from './deploy-to-bucket'
  extFromRuntime, wskRequest, inBrowser, RuntimeTable, delay, // from './util'
  GithubDef, isGithubRef, parseGithubRef, fetchProject, // from './github'
  NimBaseCommand, NimLogger, parseAPIHost, NimFeedback, disambiguateNamespace // from './NimBaseCommand'
} from 'nimbella-deployer'

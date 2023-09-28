#!/usr/bin/env groovy 

/*
 * This file bootstraps the codified Continuous Delivery pipeline for extensions of SAP solutions such as SAP S/4HANA.
 * The pipeline helps you to deliver software changes quickly and in a reliable manner.
 * A suitable Jenkins instance is required to run the pipeline.
 * More information on getting started with Continuous Delivery can be found here: https://sap.github.io/jenkins-library/
 */

@Library('piper-lib-os') _
node() {
    stage('prepare') {
        deleteDir()
        checkout scm
        setupCommonPipelineEnvironment script: this,
        verbose: true
    }
    stage('build') {
        mtaBuild script: this,
        mtaBuildTool: 'cloudMbt',
        verbose: true               
    }
    stage('deploy') {
        cloudFoundryDeploy script: this,
        deployTool:'mtaDeployPlugin',
        verbose: true
    }
    stage('Validation') {
        npmExecuteScripts script: this,
        verbose: true
    }
    stage('tmsUpload') {
       tmsUpload script: this
    }
        
    stage('Trigger_DWC_Pipeline') {
      build 'HDACSM/dwc_cli_ctms/master'
    } 
}

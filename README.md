********** CICD Automation Pipeline Repo HANA Cloud HDI ****************

Refer to the following blogs
> This repo is part of a blog series on SAP Datasphere and SAP HANA Cloud CI/CD. 
>1. [SAP Datasphere SAP HANA Cloud HDI CI/CD Automation Approach](https://blogs.sap.com/2022/10/10/sap-data-warehouse-cloud-sap-hana-cloud-hdi-ci-cd-automation-approach/)
>2. [SAP Datasphere SAP HANA Cloud HDI Automation CI/CD Pipelines Details](https://blogs.sap.com/2022/10/11/sap-data-warehouse-cloud-sap-hana-cloud-hdi-automation-ci-cd-pipelines-details/)

recap pipeline flow and transport landscape setup. 

**Figure (a) depicts the transport landscape.** 

![image](https://media.github.tools.sap/user/11116/files/b4e65f53-669c-4f4e-af93-630dae03924f)
**Figure (b) Automation flow**

Figure (b) outlines the automation flow; two pipelines are linked to two separate GIT repos for the HDI container and SAP Datasphere artifacts. The flow can either start from the HDI container pipeline or the SAP Datasphere pipeline. Suppose it involves committing HDI container artifacts via VS code or Business Application Studio. Webhook will trigger the HDI pipeline to build, deploy, validate, and upload MTA archives to SAP Cloud Transport Management. SAP Cloud Transport Management will move the MTA archives through the landscape. If all the earlier steps are successful, it will trigger the SAP Datasphere pipeline. SAP Datasphere pipeline flows through the build, deploy and validation of SAP Datasphere artifacts, deploying them into QA space.

And this repo is for pipeline 1
![image](https://media.github.tools.sap/user/11116/files/2723dd79-2e2f-4636-a3db-0f43a4b45a3c)

**Pipeline 1 – SAP HANA Cloud HDI Container**
For pipeline 1, I am using an existing HANA Cloud GIT repo leveraging Cloud Application Programming Model. Using project “Piper,” we provide instructions for the build server within the CAP project. This is done using two artifacts – Jenkinsfile and .pipeline/config.yml. You can create these two files manually in your project or generate them using  the @sap/cds-dk command line interface (CLI) as below:

`cds add pipeline`

**Jenkinsfile**
```bash
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
```
**.pipeline/config.yml**
```bash
steps:
  ###  Stage Build 
  mtaBuild:
    buildTarget: 'CF'
  ###  Stage Deploy CF deploy
  cloudFoundryDeploy:
    deployTool: 'mtaDeployPlugin'
    deployType: 'standard'
    cloudFoundry:
      org: 'CF-ORG-ABC-E2E-DEMOS'
      space: 'ABC-E2E-DEMOS-DWC-SPACE'
      credentialsId: 'CF-CREDENTIALSID'
      database_id: XeeabcdX-abcd-481d-abcd-00b0417Xabcd
  ###  Stage Validation, 
  #Execute npm script 'test' to validate db artifacts.
  npmExecuteScripts:
    buildDescriptorExcludeList:
      - db/package.json
    runScripts: 
      - "test"
  ###  Stage tmsUpload, Trigger cTMS to move through landscape
  tmsUpload:
    credentialsId: 'BTP-TMS'
    nodeName: 'IMPORT_DEV'
    verbose: 'true'
```
As shown in the files above, the full coordination and sequencing of pipelines are done using the Piper library. Details of what happens in each stage, prepare, build, deploy and tmsUpload have been explained in the blog post “SAP Business Technology Platform – integration aspects in the CI/CD approach“; please refer to the “Automation pipeline and end point” section. The only addition here is the validation stage and triggering pipeline 2. For the validation stage, I used a unit testing code similar to what Thomas Jung explained in “SAP HANA Basics For Developers: Part 12 Unit Tests”. I have adapted the code from the git repo https://github.com/SAP-samples/hana-opensap-cloud-2020 to use gulp 4.0 since the earlier 3.9 version would no longer work with the latest node version. In the validation stage, we run the “SELECT * FROM” query on each of the views and tables in the HDI container to ensure nothing is broken after changes to the repo.

Now let’s look at specific elements in mta.yml and mtaext files, which helps in realizing the landscape as shown in figure (b).  The tmsUpload method uploads the solution package to an import buffer of the SAP Cloud Transport Management service (cTMS) node. The MTA extension descriptor (mtaext) is uploaded to the nodes in the transport landscape of SAP Cloud transport management, which helps apply QA configuration.

* Add app-name under deployer module, service name and schema name under com.sap.xs.hdi-container resource parameter. Override the app-name, service name and schema name in the mtaext file.
    * app-name: HDIDEV -> HDIQA
    * service-name: SP_PROJECTDEV_DWC_S1 -> SP_PROJECTQA_DWC_S1
    * schema: SP_PROJECTDEV_DWC_HDI -> SP_PROJECT_QA_DWC_HDI
    If you remove schema, you will end with guids as schema names. Functionality wise it would be ok; however, having schema names might make maintenance easier.
* Rather than the actual UPS service name, the key added under the SERVICE_REPLACEMENTS group is used under hdbgrants and synonymconfig to override the UPS service name under mtaext.
service-name: UPS_SQL_SP_PROJECTDEV -> UPS_SQL_SP_PROJECTQA

**mta.yaml**
```bash
ID: MVP_SP
version: 0.0.1
modules:
# --------------------Deployer (side car)--------------
- name: db # deployer
# -----------------------------------------------------
  type: hdb
  path: db
  parameters:
    app-name: HDIDEV
  requires:
  - name: HDI_SPDEV # Depends on the HDI Container
    properties:
      TARGET_CONTAINER: ~{hdi-container-name}
  - name: DWC.UPS_SQL_SP_PROJECTDEV  
    group: SERVICE_REPLACEMENTS
    properties:
      key: ups_schema_access
      service: '~{ups_sql_sp}'
resources:
# --------------------HDI Container--------------
- name: HDI_SPDEV
# -----------------------------------------------
  type: com.sap.xs.hdi-container
  parameters:
    config:
      database_id: Xee99a70-abcd-481d-abcd-00b0417Xabcd # to deploy against DWC HC
      schema: SP_PROJECTDEV_DWC_HDI
    service-name: SP_PROJECTDEV_DWC_S1
  properties:
    hdi-container-name: ${service-name}
# --------------------UPS user provided service --------------
# to be created first in the CF space in which this HDI shared service gets created. 
# Credential you get from DWC Space management. You use this service to access DWC views
- name: DWC.UPS_SQL_SP_PROJECTDEV 
# # --------------------------------------------------------------
  type: org.cloudfoundry.existing-service
  parameters:
    service-name: UPS_SQL_SP_PROJECTDEV
  properties:
    ups_sql_sp: ${service-name}
```
**MTA Extension File .mtaext**
```bash
_schema-version: "3.1"
ID: MVP_SP.config.first
extends: MVP_SP

modules:
- name: db
  type: hdb
  path: db
  parameters:
    app-name: HDIQA
resources:
  - name: VI_HDI_SPDEV
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared
      config:
        database_id: Xee99a70-abcd-481d-abcd-00b0417Xabcd
        schema: SP_PROJECT_QA_DWC_HDI
      service-name: SP_PROJECTQA_DWC_S1
    properties:
      hdi-container-name: ${service-name}
  - name: DWC.UPS_SQL_SP_PROJECTDEV 
    type: org.cloudfoundry.existing-service
    parameters:
        service-name: UPS_SQL_SP_PROJECTQA
```

# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Architecture 

[1] User Uploads Image
        │
        ▼
+----------------------+
|  S3: Source Image    |  <-- Raw image goes here
+----------------------+
        │
        │  (S3 event notification)
        ▼
+----------------------+
|     SQS Queue        |  <-- Decouples processing
+----------------------+
        │
        │  (Event Source for Lambda)
        ▼
+----------------------------+
| Lambda: imageProcessor     |
|  - Downloads original      |
|  - Resizes via Sharp       |
|  - Uploads thumbnails      |
|  - Stores metadata         |
+----------------------------+
        │         │
        ▼         ▼
+----------------+  +----------------------+
| S3: Thumbnails |  | DynamoDB: Metadata   |
+----------------+  +----------------------+

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path'; 

export class LambdaSqsImageDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create an S3 bucket to upload images 
    const imageBucket = new s3.Bucket(this, 'ImageUploadBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // delete bucket when stack is destroyed. Dev only. 
      autoDeleteObjects: true,
    })

    // Create an SQS queue to receive image upload jobs from S3 events
    const imageQueue = new sqs.Queue(this, 'ImageProcesssingQueue', {
      queueName: 'ImageJobQueue', // specify a name for the queue to make it easier to identify in AWS Console 
    })

    // Create a Lambda function to process images from the SQS queue
    const imageProcessorFn = new lambdaNodejs.NodejsFunction(this, 'ImageProcessorFn', {
      entry: path.join(__dirname, '../lambda/imageProcessor/index.ts'), // path to the Lambda function code
      handler: 'handler', // the exported handler function in the code
      runtime: lambda.Runtime.NODEJS_18_X, // specify the Node.js runtime
      timeout: cdk.Duration.seconds(30),
      bundling: {
        minify: true, 
        sourceMap: false,
      },
    });

    // Connect the Lambda function to the SQS queue
    imageProcessorFn.addEventSource(new sources.SqsEventSource(imageQueue));

    // Grant the Lambda function permissions to read from and write to the S3 bucket
    imageBucket.grantReadWrite(imageProcessorFn);

    // Grant the S3 bucket permission to send messages to the SQS queue 
    imageQueue.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW, // allow the action 
      principals: [new iam.ServicePrincipal('s3.amazonaws.com')], // only S3 can send messages to this queue
      actions: ['sqs:SendMessage'], // allow S3 to send messages to the queue
      resources: [imageQueue.queueArn], // restrict to this queue only
      conditions: { 
        ArnEquals: {
          'aws:SourceArn': imageBucket.bucketArn, // restrict to this bucket only
        }
      }
    }));

    // Add an S3 event notification to the imageBucket to send messages to the SQS queue when an object is created 
    imageBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED, // trigger on object creation 
      new s3n.SqsDestination(imageQueue) // send the message to the SQS queue 
    );

    // Output the bucket name
    new cdk.CfnOutput(this, 'ImageBucketName', {
      value: imageBucket.bucketName,
    }) 

    // Output the queue URL 
    new cdk.CfnOutput(this, 'ImageQueueArn', {
      value: imageQueue.queueArn,
    })

  }
}

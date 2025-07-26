import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';

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

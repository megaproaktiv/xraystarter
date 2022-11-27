import { join } from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_dynamodb, aws_lambda, aws_lambda_event_sources, aws_logs, aws_s3, CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import * as aws_sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as s3_notifications from 'aws-cdk-lib/aws-s3-notifications';



export class XraystarterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // *** TypeScript ***
    const fnTS = new NodejsFunction(this, "xraystarter-ts", {
      entry: 'lambda/ts/index.ts',
      functionName: "xraystarter-ts",
      handler: 'lambdaHandler',
      runtime: aws_lambda.Runtime.NODEJS_16_X,
      memorySize: 1024,
      timeout: Duration.seconds(3),
      description: "xraystarter-ts",
      logRetention: aws_logs.RetentionDays.ONE_MONTH,
      tracing: aws_lambda.Tracing.ACTIVE,
      architecture: aws_lambda.Architecture.X86_64,
    })

    new CfnOutput(this, "LambdaNameTS", {
      value: fnTS.functionName,
      exportName: 'xraystarter-ts-name',
    })

    // *** Python ***
    const fnPy = new PythonFunction(this, 'xraystarter-py', {
      entry: './lambda/py', // required
      functionName: "xraystarter-py",
      index: 'app.py',
      handler: 'lambda_handler',
      runtime: aws_lambda.Runtime.PYTHON_3_8,
      memorySize: 1024,
      timeout: Duration.seconds(3),
      description: 'xraystarter-py',
      logRetention: aws_logs.RetentionDays.ONE_MONTH,
      tracing: aws_lambda.Tracing.ACTIVE,
    });

    new CfnOutput(this, 'LambdaNamePy', {
      value: fnPy.functionName,
      exportName: 'xraystarter-py-name',
    });

    // *** GO ***
    const fnGO = new aws_lambda.Function(this, 'xraystarter-go', {
      runtime: aws_lambda.Runtime.GO_1_X,
      code: aws_lambda.Code.fromAsset(join(__dirname, '../lambda/go/dist/main.zip')),
      handler: 'main',
      functionName: "xraystarter-go",
      description: 'xraystarter-go',
      memorySize: 1024,
      timeout: Duration.seconds(3),
      logRetention: aws_logs.RetentionDays.ONE_MONTH,
      tracing: aws_lambda.Tracing.ACTIVE,
    });
    new CfnOutput(this, 'LambdaNameGo', {
      value: fnGO.functionName,
      exportName: 'xraystarter-GO-name',
    });


    // Bucket start ****************
    // *
    const bucky = new aws_s3.Bucket(this, 'incoming', {
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
    });
    new CfnOutput(this, 'BucketName', {
      value: bucky.bucketName,
    });
    // Tell Lambda the dynamic bucket name
    fnTS.addEnvironment('Bucket', bucky.bucketName);
    fnPy.addEnvironment('Bucket', bucky.bucketName);
    fnGO.addEnvironment('Bucket', bucky.bucketName);

    // *
    // give lambda read rights
    bucky.grantRead(fnTS);
    bucky.grantRead(fnPy);
    bucky.grantRead(fnGO);
    // *
    // Bucket end *******************

    // Event start *******************
    const topic = new aws_sns.Topic(this, 's3eventTopic');
    topic.addSubscription(new subscriptions.LambdaSubscription(fnTS));
    topic.addSubscription(new subscriptions.LambdaSubscription(fnPy));
    topic.addSubscription(new subscriptions.LambdaSubscription(fnGO));

    bucky.addEventNotification(
      aws_s3.EventType.OBJECT_CREATED,
      new s3_notifications.SnsDestination(topic)
    )
    // Event End   *******************

    //** Dynamodb start */
    const table = new aws_dynamodb.Table(this, 'items', {
      partitionKey: {
        name: 'itemID',
        type: aws_dynamodb.AttributeType.STRING,
      },
      tableName: 'items',
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
      billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    fnTS.addEnvironment('TableName', table.tableName);
    fnPy.addEnvironment('TableName', table.tableName);
    fnGO.addEnvironment('TableName', table.tableName);
    table.grantReadWriteData(fnTS);
    table.grantReadWriteData(fnPy);
    table.grantReadWriteData(fnGO);
    new CfnOutput(this, 'TableName', {
      value: table.tableName,
    });
    //** Dynamodb End */
  }
}

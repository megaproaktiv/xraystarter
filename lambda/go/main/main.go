package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"github.com/aws/aws-sdk-go-v2/aws"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/aws/aws-xray-sdk-go/instrumentation/awsv2"
	"github.com/aws/aws-xray-sdk-go/xray"
	"github.com/aws/aws-xray-sdk-go/xraylog"

	"github.com/aws/smithy-go"
)

var Client *dynamodb.Client

func init() {
	xray.Configure(xray.Config{
		DaemonAddr:       "127.0.0.1:2000", // default
		ServiceVersion:   "1.2.3",
	  })
	xray.SetLogger(xraylog.NewDefaultLogger(os.Stderr, xraylog.LogLevelError))
  
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic("unable to load SDK config, " + err.Error())
	}
	// Using the Config value, create the DynamoDB client
	awsv2.AWSV2Instrumentor(&cfg.APIOptions)
	Client = dynamodb.NewFromConfig(cfg)
	
}

// Item holds Dynamodb input
type Item struct {
	itemID string `json:"itemID"`
    time  string `json:"time"`
}


// MyEvent Struct for S3 event
type MyEvent struct {
	Name string `json:"name"`
}

// HandleRequest S3->SNS Event
func handler(ctx context.Context, snsEvent events.SNSEvent) {

	// See https://github.com/aws/aws-lambda-go/tree/master/events
	// Handle only one event
	snsInput := snsEvent.Records[0].SNS.Message
	bytes := []byte(snsInput)
	var s3input events.S3Event
	json.Unmarshal(bytes, &s3input)

	fmt.Printf("Bucket = %s, Key = %s \n", s3input.Records[0].S3.Bucket.Name, 
	s3input.Records[0].S3.Object.Key)

	ctx, sub := xray.BeginSubsegment(ctx, "items")
	defer sub.Close(nil)

	putItem(ctx,s3input.Records[0].S3.Object.Key)

}

func putItem(ctx context.Context, itemID string){

	tableName := os.Getenv("TableName")


	// Create DynamoDB client
	
	t := time.Now()

	input := &dynamodb.PutItemInput{
        Item: map[string]types.AttributeValue{
            "itemID": &types.AttributeValueMemberS{
                Value: itemID,
			},
			"time" : &types.AttributeValueMemberS{
				Value: t.String(),
			},
        },
        TableName: aws.String(tableName),
    }
  
	result, err := Client.PutItem(ctx,input)
	if err != nil {
		// To get a specific API error
			var notFoundErr *types.ResourceNotFoundException
			if errors.As(err, &notFoundErr) {
				log.Printf("scan failed because the table was not found, %v",
					notFoundErr.ErrorMessage())
			}
	
			// To get any API error
			var apiErr smithy.APIError
			if errors.As(err, &apiErr) {
				log.Printf("scan failed because of an API error, Code: %v, Message: %v",
					apiErr.ErrorCode(), apiErr.ErrorMessage())
			}
	
			// To get the AWS response metadata, such as RequestID
			var respErr *awshttp.ResponseError // Using import alias "awshttp" for package github.com/aws/aws-sdk-go-v2/aws/transport/http
			if errors.As(err, &respErr) {
				log.Printf("scan failed with HTTP status code %v, Request ID %v and error %v",
					respErr.HTTPStatusCode(), respErr.ServiceRequestID(), respErr)
			}
	
			return
			
		}


	fmt.Println("Successfully added " ,result)
}

func main() {

	lambda.Start(handler)

}


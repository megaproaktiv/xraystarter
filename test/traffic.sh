#!/bin/bash
export BUCKET=`aws cloudformation describe-stacks --stack-name xraystarter --query "Stacks[?StackName == 'xraystarter'][].Outputs[?OutputKey == 'BucketName'].OutputValue" --output text`
for i in 0 1 2 3 4 5 6 7 8 9 
do
    for k in 0 1 2 3 4 5 6 7 8 9
    do
    for l in 0 1 2 3 4 5 6 7 8 9
    do
    for m in 0 1 2 3 4 5 6 7 8 9
    do
        date
        aws s3 cp readme.md s3://${BUCKET}//test-2${i}-${k}-${l}-${m}
        sleep 10
    done
    done
    done
done

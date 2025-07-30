import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQSHandler } from 'aws-lambda';

// Initialize the S3 client  
const s3 = new S3Client({}); 

/**
 * SQS handler to process image upload events from the SQS queue.
 * This function retrieves the image from S3, resize it, and uploads the resized image back to S3. 
 * 
 * @param event - SQS event containing messages with S3 object information
 */
export const handler: SQSHandler = async (event) =>{
  // Loop through each record in the event
  for (const record of event.Records) {
    try {
      // Log the record for debugging
      console.log('Processing record:', record);

      // Parse the message body from the SQS record
      const messageBody = JSON.parse(record.body);
      
      // Handle S3 test events
      if (messageBody.Event === 's3:TestEvent') {
        console.log('Skipping S3 test event');
        continue;
      }
      
      // Handle malformed messages
      if (!messageBody.Records || messageBody.Records.length === 0) {
        console.log('No Records found in message body, skipping');
        continue;
      }

      // Parse the S3 event from the SQS message body
      const s3Event = messageBody.Records[0];

      // Extract bucket name and object key from the S3 event
      const bucket = s3Event.s3.bucket.name; 
      const key = decodeURIComponent(s3Event.s3.object.key.replace(/\+/g, ' '));

      // Prevent infinite loop by checking if the key already starts with 'thumbnails/'
      if (key.startsWith('thumbnails/')) {
        console.log(`INFINITE LOOP PREVENTION: Skipping file already in thumbnails folder: ${key}`);
        continue;
      }

      // Log the bucket and key for debugging
      console.log(`Processing image from ${bucket}/${key}`);

      // Fetch the image object from S3
      const getObjectResponse = await s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key, 
      }));

      // Convert the image data (stream) to a buffer 
      const bodyBytes = await getObjectResponse.Body?.transformToByteArray(); 

      // If something went wrong, throw an error
      if (!bodyBytes) {
        throw new Error('Failed to retrieve image data from S3');
      }
    
      // Resize the image using sharp *COMMENT OUT NOW FOR DEBUGGING
      // const resized = await sharp(bodyBytes)
      //   .resize(300, 300, {
      //     fit: 'inside',
      //     withoutEnlargement: true
      //   })
      //   .jpeg({ quality: 80 })
      // //   .toBuffer();

      // // Create a new S3 key for the reesized thumbnail 
      // const newKey = `thumbnails/${key.replace(/\.[^/.]+$/, '')}_thumb.jpg`;

      // // upload the resized image back to S3 
      // await s3.send(new PutObjectCommand({
      //   Bucket: bucket,
      //   Key: newKey,
      //   Body: bodyBytes, // Temporary returning the original image for debugging
      //   ContentType: 'image/jpeg', // Set the content type for the resized image
      // }));

      // Get the original content type to preserve it
      const originalContentType = getObjectResponse.ContentType || 'application/octet-stream';
      
      // Extract file extension from original file
      const fileExtension = key.split('.').pop()?.toLowerCase() || 'jpg';
      const fileNameWithoutExtension = key.replace(/\.[^/.]+$/, '');
      
      // Create a new S3 key for the thumbnail, preserving original extension
      const newKey = `thumbnails/${fileNameWithoutExtension}_thumb.${fileExtension}`;

      // Upload the image (same content for now) to thumbnails folder
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: newKey,
        Body: bodyBytes,
        ContentType: originalContentType, // Use original content type
        // Add metadata to track processing
        Metadata: {
          'processed-by': 'lambda-thumbnail-processor',
          'processed-at': new Date().toISOString(),
          'original-file': key,
          'original-size': bodyBytes.length.toString()
        }
      }));

      // // Log the successful upload of the resized image
      // console.log(`Resized image uploaded to ${bucket}/${newKey}`);

      // Log the successful upload
      console.log(`Thumbnail uploaded to ${bucket}/${newKey}`);
      console.log(`Original: ${key} (${bodyBytes.length} bytes, ${originalContentType})`);
      console.log(`Thumbnail: ${newKey} (${originalContentType})`);

    } catch (err) {
      // Log any errors that occur during processing
      console.error('Error processing message: ', err);
      throw err; // Re-throw to trigger retry/DLQ
    }
  }
}
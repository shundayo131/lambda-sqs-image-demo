import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQSHandler } from 'aws-lambda';
import sharp from 'sharp';

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

      // Parse the S3 event from the SQS message body
      const s3Event = JSON.parse(record.body).Records[0];

      // Extract bucket name and object key from the S3 event
      const bucket = s3Event.s3.bucket.name; 
      const key = decodeURIComponent(s3Event.s3.object.key.replace(/\+/g, ' '));

      // Log the bucket and key for debugging
      console.log(`Processing image from ${bucket}/${key}`);

      // Fetch the image object from S3
      const getObject = await s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key, 
      }));

      // Convert the image data (stream) to a buffer 
      const bodyBytes = await getObject.Body?.transformToByteArray(); 

      // If something went wrong, throw an error
      if (!bodyBytes) {
        throw new Error('Failed to retrieve image data from S3');
      }

      // Resize the image using sharp 
      const resized = await sharp(bodyBytes)
        .resize(300, 300, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Create a new S3 key for the reesized thumbnail 
      const newKey = `thumbnails/${key.replace(/\.[^/.]+$/, '')}_thumb.jpg`;

      // upload the resized image back to S3 
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: newKey,
        Body: resized,
        ContentType: 'image/jpeg', // Set the content type for the resized image
      }));

      // Log the successful upload of the resized image
      console.log(`Resized image uploaded to ${bucket}/${newKey}`);

    } catch (err) {
      // Log any errors that occur during processing
      console.error('Error processing message: ', err);
      throw err; // Re-throw to trigger retry/DLQ
    }
  }
}
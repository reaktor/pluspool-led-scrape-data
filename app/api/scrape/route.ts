import { NextApiRequest, NextApiResponse } from 'next';
import { retrieveDataSets, uploadFile } from '../../../etl.js';
 
export async function GET(request: NextApiRequest, response: NextApiResponse) {
  await retrieveDataSets()
  await uploadFile()
  
  response.status(200).json({
    body: request.body,
    query: request.query,
    cookies: request.cookies,
  });
}

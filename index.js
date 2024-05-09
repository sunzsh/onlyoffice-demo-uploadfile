const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

const chunkUploadSize = 1024 * 1024 * 10; // 10MB
const folderId = "123"
const baseUrl = "https://xxxx.onlyoffice.com" // 修改自己的onlyoffice地址
const username = ""
const password = ""


async function readFile(filePath) {
  // 读取本地文件的data和size
  const data = await fs.promises.readFile(filePath);
  const size = data.byteLength;
  return { data, size };
}

async function getAuthorization() {
  const body = {
    "UserName": username,
    "Password": password
  }
  const url = `${ baseUrl }/api/2.0/authentication`
  const response = await fetch(url, {
    "body": JSON.stringify(body),
    "headers": { "Content-Type": "application/json" },
    "method": "POST"
  })
  const json = await response.json()
  return json.response
}

async function upload(file, fileName, authentication) {
  const { data, size } = file;
  console.log(`fileSize: ${size}`);
  const body = {
    "CreateOn": new Date().toISOString(),
    "FileName": fileName,
    "FileSize": size,
    "folderId": folderId
  }

  const url = `${baseUrl}/api/2.0/files/${folderId}/upload/create_session`
  const sessionResponse = await fetch(url, {
      "body": JSON.stringify(body),
      "headers": { "Content-Type": "application/json" , "Authorization": authentication },
      "method": "POST"
  })

  const res = (await sessionResponse.json());
  const session = res.response

  const requestsDataArray = []
  const chunks = Math.ceil(size / chunkUploadSize)
  let chunk = 0

  let sum = 0;
  while (chunk < chunks) {
      const offset = chunk * chunkUploadSize
      const formData = new FormData()
      const buff = Buffer.from(data.subarray(offset, offset + chunkUploadSize > size ? size + 1 : offset + chunkUploadSize));
      formData.append("file", buff, fileName)
      formData.append("Content-Disposition", `form-data; name="file"; filename="${fileName}"`);
      requestsDataArray.push(formData)
      chunk = chunk + 1
  }

  let result
  for (let i = 0; i < requestsDataArray.length; i++) {
      const formData = requestsDataArray[i]
      const headers = {
          "Authorization": authentication,
          "Content-Length": formData.getLengthSync(),
      };
      console.log(`uploading chunk ${i + 1} of ${requestsDataArray.length}`);
      let res = await fetch(session.data.location, {
          "body": formData,
          "headers": headers,
          "method": "POST"
      })
      const resObj = await res.json()
      if (resObj.data.uploaded) {
        result = resObj.data
      }
  }
  return result;
}

async function fileLink(authentication ,fileId) {

  const url = `${baseUrl}/api/2.0/files/file/${fileId}/link`
  const response = await fetch(url, {
      "headers": { "Content-Type": "application/json" , "Authorization": authentication },
      "method": "GET"
  })

  const json = await response.json()
  return json
}

async function main() {
  const filePath = "/Users/sunzsh/Desktop/test_doc/全国居民人均收入情况.xlsx";
  const file = await readFile(filePath);
  const fileName = filePath.split('/').pop();

  const authentication = await getAuthorization();
  const res = await upload(file, fileName, authentication.token);
  const docFile = await fileLink(authentication.token, res.id)
  console.log(res.id, docFile.response.sharedTo.requestToken);
}

main()

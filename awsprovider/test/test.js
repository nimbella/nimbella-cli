const provider = require('@nimbella/storage-s3').default
const axios = require('axios')

test()

async function test() {
	const KEY_ID = process.env.KEY_ID
	const SECRET_KEY = process.env.SECRET_KEY
	const creds = { credentials: { accessKeyId: KEY_ID, secretAccessKey: SECRET_KEY, region: 'us-east-1'} }
	const client = provider.getClient('testuser3', creds.endpoint, true, creds)
	let file = client.file('test.txt')
	let data = Buffer.from('This is text for test.txt')
	try {
		await file.save(data)
		console.log('Saved contents in test.txt')
	} catch (err) {
		console.error(err)
	}
	console.log('Changing the content type to text/plain')
	try {
		await file.setMetadata({ contentType: 'text/plain' })
		console.log('Change succeeded')
	} catch (err) {
		console.error(err)
	} 
	console.log('Saving again with content type on the request')
	try {
		await file.save(data, { metadata: { contentType: 'text/plain' } })
		console.log('Saved contents in test.txt')
	} catch (err) {
		console.error(err)
	}
	try {
		const contents = await file.download()
		console.log('got buffer of length', contents.length)
		console.log(String(contents))
	} catch (err) {
		console.error(err)
	}
	file = client.file('test2.txt')
	data = Buffer.from('This is text for test2.txt')
	const expires = Date.now() + 60000
	const url = await file.getSignedUrl({version: 'v4', action: 'write', expires})
	console.log('got signed url for test2.txt:', url)
	try {
    	const putres = await axios.put(url, data)
		if (putres.status === 200) {
			console.log('put to signed url was successful')
		} else {
			console.log('bad response from axios:', putres)
		}
	} catch (err) {
		console.error(err)
	}
	console.log('Changing the content type to text/plain, and cache control to no-cache')
	try {
		await file.setMetadata({ contentType: 'text/plain', cacheControl: 'no-cache' })
		console.log('Change succeeded')
	} catch (err) {
		console.error(err)
	} 
}

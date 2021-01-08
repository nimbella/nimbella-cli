const provider = require('@nimbella/storage-s3').default

test()

async function test() {
	const KEY_ID = process.env.KEY_ID
	const SECRET_KEY = process.env.SECRET_KEY
	// Use the following to test on Seeweb/Scality
	const creds = { endpoint: 'https://s3cube.it', credentials: { accessKeyId: KEY_ID, secretAccessKey: SECRET_KEY } }
	const client = provider.getClient('josh', creds.endpoint, true, creds)
	// Use the following alternative to test on AWS
	// const creds = { credentials: { accessKeyId: KEYID, secretAccessKey: SECRET_KEY, region: 'us-east-1'} }
	// const client = provider.getClient('josh-backup', creds.endpoint, true, creds)
	let file = client.file('index.html')
	try {
		const contents = await file.download()
		console.log('got buffer of length', contents.length)
		console.log(String(contents))
	} catch (err) {
		console.error(err)
	}
	file = client.file('test.txt')
	const data = Buffer.from('This is text for test.txt')
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
}

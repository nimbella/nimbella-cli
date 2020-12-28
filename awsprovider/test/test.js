const provider = require('@nimbella/storage-s3').default

test()

async function test() {
	const creds = { endpoint: 'https://s3cube.it', credentials: { accessKeyId: 'GMQ4K121295L5AW8MLWC', secretAccessKey: '70z6/Kx5+p8wkNz66U5PWmH5ErQnD1jwJYSD5XL4' } }
	const client = provider.getClient('josh', creds.endpoint, true, creds)
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
	try {
		const contents = await file.download()
		console.log('got buffer of length', contents.length)
		console.log(String(contents))
	} catch (err) {
		console.error(err)
	}
}

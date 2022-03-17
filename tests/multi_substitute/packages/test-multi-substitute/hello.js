function main(args) {
    return {
        "parameters": [
            {
                "key": "A",
                "value": args.A
            }, 
            {
                "key": "B",
                "value": args.B
            },
            {
                "key": "C",
                "value": process.env.C
            }
        ]
    }
}

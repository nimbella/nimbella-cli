import pyjokes

def main(args):
  joke = pyjokes.get_jokes(category='chuck')[0]
  return {
    'body': {
      'response_type': 'in_channel',
      'text': joke
    }
  }

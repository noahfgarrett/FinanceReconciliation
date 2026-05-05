import '@testing-library/jest-dom'

// jsdom 25 does not implement Blob.text() / File.text(); polyfill for tests.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.text === 'undefined') {
  Blob.prototype.text = function (): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(this)
    })
  }
}

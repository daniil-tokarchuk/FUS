function createInputElement() {
  const inputElement = document.createElement('div')
  inputElement.className = 'input-element'
  const input = createInput()
  const button = createButton('Add', input)
  inputElement.append(input, button)
  document.querySelector('.input-container').appendChild(inputElement)
}

function createInput() {
  const input = document.createElement('input')
  input.type = 'text'
  return input
}

function createButton(text, input) {
  const button = document.createElement('button')
  button.className = 'input-button'
  button.textContent = text
  button.addEventListener('click', () => toggleInput(input, button))
  return button
}

function toggleInput(input, button) {
  const buttonType = button.textContent
  if (['Add', 'Done'].includes(buttonType) && isValidInput(input)) {
    input.disabled = true
    button.textContent = 'Edit'
    if (buttonType === 'Add') {
      const deleteButton = createButton('Delete', input)
      input.parentNode.append(deleteButton)
      createInputElement()
    }
  } else if (buttonType === 'Edit') {
    input.disabled = false
    button.textContent = 'Done'
  } else if (buttonType === 'Delete') {
    document.querySelectorAll('.input-element').length > 1 ?
      input.parentNode.remove()
    : alert('Cannot delete the last input field.')
  }
}

function upload() {
  this.disabled = true
  const inputs = Array.from(
    document.querySelectorAll('.input-element input:disabled'),
  )
  if (inputs.length === 0) {
    alert('Please add at least one URL.')
    this.disabled = false
    return
  }
  if (inputs.some((input) => !isValidInput(input))) {
    this.disabled = false
    return
  }
  const urls = inputs.map((input) => input.value.trim())

  const outputContainer = document.querySelector('.output-container')
  outputContainer.innerHTML = '<p>Uploading...</p>'
  outputContainer.style.marginTop = '1rem'
  fetch('/api/v1/upload-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: urls }),
  })
    .then((response) => response.json())
    .then(({ results }) => displayResults(results))
    .catch(() => alert('Upload failed.'))
    .finally(() => {
      this.disabled = false
    })
}

function displayResults(results) {
  const outputContainer = document.querySelector('.output-container')
  outputContainer.innerHTML = ''
  outputContainer.style.marginTop = '0'

  results.forEach((item) => {
    const result = document.createElement('div')
    result.className = 'result'
    result.innerHTML =
      item.status === 'success' ?
        `<p class="result-header"><strong>Success</strong></p>
         <div class="result-body">
           <p>- URL: ${item.url}</p>
         </div>
         <p class="result-header"><strong>Drive File Info</strong></p>
         <div class="result-body">
           <p>- name: ${item.name}</p>
           <p>- type: ${item.mimeType}</p>
           <p>- size: ${item.size}</p>
           <p>- view: <a href="${item.webViewLink}" target="_blank">${item.webViewLink}</a></p>
         </div>`
      : `<p class="result-header"><strong>Error</strong></p>
         <div class="result-body">
           <p>- URL: ${item.url}</p>
           <p>- info: ${item.error}</p>
         </div>`
    outputContainer.appendChild(result)
  })
}

function isValidInput(input) {
  const value = input.value.trim()
  if (!isValid(value)) {
    input.classList.add('invalid')
    alert('Invalid URL.')
    return false
  }
  input.classList.remove('invalid')
  return true
}

function isValid(value) {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

document.querySelector('.upload-button').addEventListener('click', upload)
createInputElement()

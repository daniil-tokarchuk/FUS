async function fetchUploadedFiles() {
  try {
    const response = await fetch('/api/v1/get-uploaded-files')
    const data = await response.json()
    const outputContainer = document.querySelector('.output-container')
    outputContainer.innerHTML = '<h1>Uploaded Files</h1>'

    if (data.files && data.files.length > 0) {
      data.files.forEach((file) => {
        const result = document.createElement('div')
        result.className = 'result'
        result.innerHTML = `
          <p class="result-header"><strong>${file.name}</strong></p>
          <div class="result-body">
            <p>- type: ${file.mimeType}</p>
            <p>- size: ${file.size}</p>
            <p>- created: ${file.createdTime}</p>
            <p>- view: <a href="${file.webViewLink}" target="_blank">${file.webViewLink}</a></p>
            <p>- download: <a href="${file.webContentLink}" target="_blank">${file.webContentLink}</a></p>
          </div>`
        outputContainer.appendChild(result)
      })
    } else {
      outputContainer.innerHTML = '<p>No files uploaded.</p>'
    }
  } catch (error) {
    console.error('Error fetching uploaded files:', error)
    document.querySelector('.output-container').innerHTML =
      '<p>Error loading files. Please try again.</p>'
  }
}

fetchUploadedFiles()

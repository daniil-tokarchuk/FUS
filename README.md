# File Upload Service

[![TypeScript](https://img.shields.io/badge/built%20with-typescript-blue)](https://www.typescriptlang.org/)

- [About](#about)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Project Commands](#project-commands)
- [API Documentation](#api-documentation)
- [System Design](#system-design)
- [Known Issues](#known-issues)

## About

This is a file upload service that allows users to upload files to Google Drive. The service is built using Node.js and
TypeScript, providing a robust and scalable solution for file management.

## Project Structure
```
.
├── README.md          <-- This instructions file
├── public             <-- Front-end static files
├── src                <-- Source code root folder
│   └── test           <-- Test files
│   └── types          <-- Custom types
├── package.json       <-- NodeJS dependencies and scripts
├── tsconfig.json      <-- Typescript configuration
├── esbuild.config.mjs <-- Esbuild configuration
├── babel.config.cjs   <-- Babel configuration
├── jest.config.mjs    <-- Tests configuration
├── Dockerfile         <-- Dockerfile for production
├── compose.yaml       <-- Docker Compose configuration for development
├── compose.prod.yaml  <-- Docker Compose configuration for production
└── ecs-params.yml     <-- ECS parameters
```

## Prerequisites

* [NodeJS 20.X installed](https://nodejs.org/en/download/releases/)
* [npm installed](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
* [Docker installed](https://docs.docker.com/get-started/get-docker/)

## Dependency Installation

* Run `npm install` to install all dependencies listed in the package.json

## Project Commands

- `npm run dev` - Build and run project in development mode
- `npm run test` - Run unit tests
- `npm run typecheck` - Check TypeScript types
- `npm run format` - Format code using Prettier
- `docker compose up` - Build and run project in development mode using Docker

## API Documentation

### Endpoints

#### `POST /api/v1/upload-files`

- **Description**: Upload given array of files to google drive.
- **Request body**:
  ```json
  {
    "urls": [
        "https://example.com/document.docx",
        "https://example.com/file.pdf",
        "https://example.com/photo.jpg"
    ]
  }
  ```

#### `GET /api/v1/get-uploaded-files`

- **Description**: Get uploaded files from google drive.
- **Response**:
  ```json
  {
    "files": [
      {
        "id": "mock-id-1",
        "name": "mock-file-1.png",
        "mimeType": "image/png",
        "webContentLink": "https://mockdrive.com/uc?id=mock-id-1&export=download",
        "webViewLink": "https://mockdrive.com/file/d/mock-id-1/view?usp=drivesdk",
        "createdTime": "2025-01-01 10:00:00",
        "modifiedTime": "2025-01-01 10:00:00",
        "size": "123.45 KB"
      },
      {
        "id": "mock-id-2",
        "name": "mock-file-2.pdf",
        "mimeType": "application/pdf",
        "webContentLink": "https://mockdrive.com/uc?id=mock-id-2&export=download",
        "webViewLink": "https://mockdrive.com/file/d/mock-id-2/view?usp=drivesdk",
        "createdTime": "2025-01-02 11:00:00",
        "modifiedTime": "2025-01-02 11:00:00",
        "size": "456.78 KB"
      }
    ]
  }
  ```

#### `GET /api/v1/get-all-files`

- **Description**: Get all files which owned by user and not trashed from google drive.
- **Response**:
  ```json
  {
    "files": [
      {
        "id": "mock-id-1",
        "name": "mock-file-1.png",
        "mimeType": "image/png",
        "webContentLink": "https://mockdrive.com/uc?id=mock-id-1&export=download",
        "webViewLink": "https://mockdrive.com/file/d/mock-id-1/view?usp=drivesdk",
        "createdTime": "2025-01-01 10:00:00",
        "modifiedTime": "2025-01-01 10:00:00",
        "size": "123.45 KB"
      },
      {
        "id": "mock-id-2",
        "name": "mock-file-2.pdf",
        "mimeType": "application/pdf",
        "webContentLink": "https://mockdrive.com/uc?id=mock-id-2&export=download",
        "webViewLink": "https://mockdrive.com/file/d/mock-id-2/view?usp=drivesdk",
        "createdTime": "2025-01-02 11:00:00",
        "modifiedTime": "2025-01-02 11:00:00",
        "size": "456.78 KB"
      }
    ]
  }
  ```

## System Design

- Front-end on native HTML/CSS/JS, framework can be used
- AWS free tier used for deployment, t2.micro instance used - 1vCPU, 1GB RAM, 30GB Volume
- Google Cloud free tier allows only 12,000 requests per minute

## Known Issues

- No code analysis tool, should be replaced with ESLint or similar
- No ORM - plain SQL, pool management, hard to maintain/extend, should be replaced with Prisma or similar
- Memory caching - not suitable for production, should be replaced with Redis or similar
- No Proxy - sites can block requests from app eventually
- Cannot automatically renew SSL certificates, because DNS used doesn’t have API for that.
- Google Cloud verification required.

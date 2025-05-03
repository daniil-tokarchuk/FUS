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

This file upload service allows users to upload files to Google Drive. The service is built using Node.js and
TypeScript provides a robust and scalable solution for file management.

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

- [NodeJS 20.X installed](https://nodejs.org/en/download/releases/)
- [npm installed](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [Docker installed](https://docs.docker.com/get-started/get-docker/)

## Dependency Installation

- Run `npm install` to install all dependencies listed in the package.json

## Project Commands

- `npm run dev` - Build and run the project in development mode.
- `npm run test` - Run unit tests.
- `npm run typecheck` - Check TypeScript types.
- `npm run format` - Format code using Prettier.
- `docker compose up` - Build and run the project in development mode using Docker.

## API Documentation

### Endpoints

#### `POST /api/v1/upload-files`

- **Description**: Upload the given array of files to Google Drive.
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

- **Description**: Get uploaded files from Google Drive.
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

- **Description**: Get all files owned by the user and not trashed from Google Drive.
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

- The front end is on native HTML/CSS/JS, and a framework can be used.
- AWS free tier is used for deployment (t2.micro instance) - 1 vCPU, 1GB RAM, 30GB volume.
- Google Cloud free tier allows only 12,000 requests per minute.
- Google API does not allow upload file size greater than 5,120 GB.

## Known Issues

- No code analysis tool, ESLint or similar, should be added.
- No ORM - plain SQL, pool management, hard to maintain/extend, should be replaced with Prisma or similar.
- In-memory store - not suitable for production, should be replaced with Redis or similar.
- No proxy sites can block requests from the app eventually.
- Cannot automatically renew SSL certificates, because the DNS used doesn’t have an API for that.
- Google Cloud verification required.
- Environment variables are not securely stored.
- Database volume is not persistent, should use RDS instead of container.
- Not fully optimized for mobile.

## Deployment Documentation

- [Deployment Documentation](https://tokarchuk.notion.site/Deployment-1e5eab1c603e80429bb1f65c169f3b67?pvs=4)

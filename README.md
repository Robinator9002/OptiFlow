# OptiFlow: Rental Management & Workflow Optimization

[![Project Status: Active Development](https://img.shields.io/badge/status-active%20development-green.svg)](https://shields.io/)
OptiFlow is a comprehensive rental management software designed to streamline workflows and optimize the operational environment for property managers and related businesses.

## Overview

The OptiFlow application is a modular system composed of several key components. These components are currently under focused development and are designed to be integrated into a cohesive and powerful platform. Our goal is to provide a modern, efficient, and user-friendly solution for managing rentals and associated administrative tasks.

## Core Components & Features

OptiFlow is currently being developed with the following core components:

### 1. OptiFlow File Manager 🗂️
The File Manager provides robust tools for local file organization and processing, tailored to the needs of rental management.
* **Local File Browse & Management:** Intuitive interface for navigating and managing your local folder structures and files.
* **Indexed Directory Scanning:** Utilizes an efficient scanning mechanism with indexing, storing file and folder metadata (potentially in a hash map or similar structure) for quick retrieval and searching.
* **PDF to OCR Conversion:** Integrated capability to convert PDF documents (e.g., scanned leases, invoices) into OCR-processed text, making them searchable and their content extractable.
* *(Planned: Advanced search filters, file tagging, version history previews, etc.)*

### 2. OptiFlow Form Manager 📋
The Form Manager modernizes and simplifies the entire lifecycle of form management, crucial for rental applications, lease agreements, maintenance requests, and more.
* **Form Creation:** Tools to easily design and build custom digital forms.
* **Form Distribution:** Streamlined processes for sending forms to tenants, applicants, or other stakeholders.
* **Digital Form Filling:** Enables recipients to fill out and submit forms electronically.
* **Submission Analysis:** Features for collecting, viewing, and analyzing data from submitted forms.
* *(Planned: Template library, automated reminders, signature integration, data export, etc.)*

## Project Status

OptiFlow is currently in **active development**.
* The **Form Manager** is the current primary focus of development efforts.
* The **File Manager** component is nearing production readiness. It requires final, thorough testing and then implementation into the main application flow.
* Additional components and enhancements to existing modules are planned and will be implemented progressively.

## Tech Stack

The Project is divided into an Frontend and Backend, one for each of the Parts. An custom Axios Wrapper is used for Communication.
* **Frontend:** *(React, Electron, HTML, Classic-CSS, TypeScript)*
* **Backend:** *(Python (FastAPI, Uvicorn, Pydantic))*
* **Database:** *(JSON and Hashmaps for the File Manager, PostgreSQL will be added for the Form Manager)*
* **Key Libraries/Frameworks:** *(Tesseract + Ghostscript for OCR-Reading, os for base-functionality like searching through files and this stuff)*

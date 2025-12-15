# Rotation Features & Intensity Tracking

This document outlines the characteristics of each assignment type available in the Residency Scheduler Pro system.

## Classification Legend

*   **Category**:
    *   **Core**: Fundamental rotations required for graduation and major staffing blocks.
    *   **Required Elective**: Rotations that must be completed by specific PGY levels (Interns, PGY2, PGY3).
    *   **Voluntary Elective**: Optional rotations available to fill gaps or for specific interest.
    *   **Other**: Non-clinical or administrative time.
*   **Setting**:
    *   **Inpatient**: Hospital-based service.
    *   **Outpatient**: Clinic or ambulatory setting.
    *   **Mix**: Combination of both.
    *   *(Note: Per configuration, all rotations not explicitly listed as Outpatient or Mix are classified as Inpatient).*
*   **Intensity Score (1-4)**:
    *   **4**: Highest intensity (e.g., ICU).
    *   **3**: High intensity (e.g., Wards Red, Night Float).
    *   **2**: Moderate intensity (e.g., Wards Blue).
    *   **1**: Standard intensity (Electives, Clinic, etc.).

## Assignment Table

| Assignment Code | Full Name | Category | Setting | Intensity Score |
| :--- | :--- | :--- | :--- | :--- |
| **ICU** | Intensive Care Unit | Core | Inpatient | **4** |
| **WARDS-R** | Wards Red | Core | Inpatient | **3** |
| **NF** | Night Float | Core | Inpatient | **3** |
| **WARDS-B** | Wards Blue | Core | Inpatient | **2** |
| **EM** | Emergency Medicine | Core | Inpatient | 1 |
| **CCIM** | Clinic | Core | **Outpatient** | 1 |
| **MET Wards** | Met Wards (Overflow) | Core/Voluntary | Inpatient | 1 |
| **CARDS** | Cardiology | Required Elective (PGY1) | Inpatient | 1 |
| **ID** | Infectious Disease | Required Elective (PGY1) | Inpatient | 1 |
| **NEPH** | Nephrology | Required Elective (PGY1) | Inpatient | 1 |
| **PULM** | Pulmonology | Required Elective (PGY1) | Inpatient | 1 |
| **ONC** | Hematology-Oncology | Required Elective (PGY2) | **Mix** | 1 |
| **NEURO** | Neurology | Required Elective (PGY2) | Inpatient | 1 |
| **RHEUM** | Rheumatology | Required Elective (PGY2) | **Outpatient** | 1 |
| **ADD MED** | Addiction Medicine | Required Elective (PGY3) | Inpatient | 1 |
| **ENDO** | Endocrinology | Required Elective (PGY3) | **Outpatient** | 1 |
| **GERI** | Geriatrics | Required Elective (PGY3) | **Outpatient** | 1 |
| **HPC** | Palliative Care | Required Elective (PGY3) | Inpatient | 1 |
| **ENT** | Otolaryngology | Voluntary Elective | **Outpatient** | 1 |
| **METRO** | Metro ICU | Voluntary Elective | Inpatient | 1 |
| **CC-ICU** | Cardiac ICU | Voluntary Elective | Inpatient | 1 |
| **HF** | Heart Failure | Voluntary Elective | Inpatient | 1 |
| **CCMA** | CCMA | Voluntary Elective | Inpatient | 1 |
| **RESEARCH** | Research | Voluntary Elective | Inpatient | 1 |
| **ELECTIVE** | Generic Elective | Voluntary Elective | Inpatient | 1 |
| **VAC** | Vacation | Other | N/A | 0 |

## Configuration Notes

*   **Outpatient Assignments**: Defined strictly as CCIM, RHEUM, ENDO, GERI, and ENT.
*   **Mixed Assignments**: Defined strictly as ONC.
*   **Inpatient Assignments**: All other clinical assignments.

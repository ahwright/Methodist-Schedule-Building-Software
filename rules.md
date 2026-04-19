
# Scheduling Rules & Constraints

This document outlines the logic and constraints used by the **Residency Scheduler Pro** algorithm.

## 1. The 4+1 Model (Cohorts)
*   **Structure**: Residents are divided into 5 cohorts (0-4), corresponding to groups A through E.
*   **Clinic Weeks**: Every 5th week is a guaranteed **Clinic (CCIM)** week.
    *   *Formula*: `Week % 5 == Cohort ID`
    *   *Constraint*: Clinic weeks are fixed and cannot be overwritten by other rotations.

## 2. Rotation Requirements

The scheduler attempts to fill shifts based on the following minimum and maximum staffing requirements per week. (Optimized for 38 Resident Program).

| Rotation | Duration | Min Interns | Max Interns | Min Seniors | Max Seniors | Total Team Size |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Night Float** | 2 Weeks | 1 | 2 | 1 | 3 | 2 - 5 |
| **ICU** | 4 Weeks | 2 | 3 | 2 | 4 | 4 - 7 |
| **Wards (Red)** | 4 Weeks | 2 | 3 | 1 | 3 | 3 - 6 |
| **Wards (Blue)** | 4 Weeks | 2 | 3 | 1 | 3 | 3 - 6 |
| **Emergency** | 2 Weeks | 1 | 2 | 0 | 2 | 1 - 4 |

### Graduation & Annual Targets

#### Core Blocks (All PGYs)
*   **Wards**: 12 weeks per year.
*   **ICU**: 8 weeks per year.

#### PGY1 Required Electives
*   **Cardiology (CARDS)**: 4 Weeks
*   **Emergency (EM)**: 4 weeks
*   **Infectious Disease (ID)**: 2 Weeks
*   **Nephrology (NEPH)**: 2 Weeks
*   **Pulmonology (PULM)**: 2 Weeks

#### PGY2 Required Rotations (Reduced 2-Week Blocks)
*   **Hematology-Oncology (ONC)**: 2 Weeks
*   **Neurology (NEURO)**: 2 Weeks
*   **Rheumatology (RHEUM)**: 2 Weeks
*   **Gastroenterology (GI)**: 2 Weeks
*   **Night Float**: 2 Weeks

#### PGY3 Required Electives
*   **Addiction Medicine (Add Med)**: 2 Weeks
*   **Endocrinology (Endo)**: 2 Weeks
*   **Geriatrics (Geri)**: 2 Weeks
*   **Palliative Care (HPC)**: 2 Weeks
*   **Night Float**: 2 Weeks

## 4. Gaps & Electives
*   Any week left unassigned after all mandatory and required rotations are processed is automatically filled with **Generic Elective**. 

## 5. Team Diversity
*   The system tracks co-working relationships to ensure residents work with a broad mix of colleagues across the PGY levels.

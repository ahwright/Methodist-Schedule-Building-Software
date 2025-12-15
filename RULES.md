# Scheduling Rules & Constraints

This document outlines the logic and constraints used by the **Residency Scheduler Pro** algorithm.

## 1. The 4+1 Model (Cohorts)
*   **Structure**: Residents are divided into 5 cohorts (0-4), corresponding to groups A through E.
*   **Clinic Weeks**: Every 5th week is a guaranteed **Clinic (CCIM)** week.
    *   *Formula*: `Week % 5 == Cohort ID`
    *   *Constraint*: Clinic weeks are fixed and cannot be overwritten by other rotations.

## 2. Rotation Requirements

The scheduler attempts to fill shifts based on the following minimum and maximum staffing requirements per week.

| Rotation | Duration | Min Interns (PGY1) | Max Interns (PGY1) | Min Seniors (PGY2/3) | Max Seniors (PGY2/3) | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Night Float** | 4 Weeks | 1 | 2 | 1 | 3 | Strict 4-week cap per resident. |
| **ICU** | 4 Weeks | 2 | 2 | 2 | 2 | |
| **Wards (Red)** | 4 Weeks | 2 | 2 | 2 | 2 | |
| **Wards (Blue)** | 4 Weeks | 2 | 2 | 2 | 2 | |
| **Emergency** | 2 Weeks | 1 | 2 | 1 | 2 | **Interns: UP TO 4 weeks max.** |

### PGY1 Required Electives
In addition to the above, Interns (PGY1) are required to complete the following electives. The scheduler attempts to place these in any remaining gaps after core rotations are assigned but *before* Emergency Medicine to ensure space is preserved.

*   **Cardiology (CARDS)**: 4 Weeks
*   **Infectious Disease (ID)**: 2 Weeks
*   **Nephrology (NEPH)**: 2 Weeks
*   **Pulmonology (PULM)**: 2 Weeks

### PGY2 Required Rotations
Residents in their second year (PGY2) have a specific set of required blocks that must be fulfilled:

*   **Hematology-Oncology (ONC)**: 4 Weeks
*   **Neurology (NEURO)**: 4 Weeks
*   **Rheumatology (RHEUM)**: 4 Weeks
*   *(Note: Metro ICU is an optional elective and not auto-assigned)*

### PGY3 Required Electives
Residents in their third year (PGY3) are required to complete the following electives:

*   **Addiction Medicine (Add Med)**: 2 Weeks
*   **Endocrinology (Endo)**: 2 Weeks
*   **Geriatrics (Geri)**: 2 Weeks
*   **Palliative Care (HPC)**: 2 Weeks

## 3. Assignment Logic

### General Block Assignment
1.  **Availability Check**: Residents must be free for the full duration of the block (e.g., 4 contiguous weeks).
2.  **Clinic Conflict**: A block cannot be assigned if it overlaps with a mandatory Clinic week, unless the rotation specifically allows interruption (currently, most 4-week blocks try to fit *between* clinic weeks or the logic handles gaps).
3.  **Prioritization**:
    *   Residents with fewer assigned weeks of that specific rotation type are prioritized (Load Balancing).
    *   Residents with specific "Avoid" constraints with currently assigned team members are deprioritized.
    *   **Priorities**: Night Float > Wards/ICU > PGY1 Required Electives > PGY2 Required Rotations > PGY3 Required Electives > Emergency Medicine > General Electives.

### Night Float (Special Handling)
To ensure fairness, Night Float uses a strict **Two-Pass System**:

*   **Target**: Every resident should have exactly **4 weeks** of Night Float.
*   **Pass 1 (Mandatory Coverage)**:
    *   Iterates sequentially (Week 1 -> 52).
    *   Fills only the **Minimum** slots (1 Intern, 1 Senior).
    *   *Priority*: Residents who have not yet reached 4 weeks.
*   **Pass 2 (Target Filling)**:
    *   Iterates through weeks in a **Randomized Order**.
    *   Fills remaining "Extra" slots (up to Max capacity).
    *   *Constraint*: **Strictly** prohibits assigning anyone who has already met the 4-week target.
    *   *Goal*: Uses excess capacity solely to help residents reach their quota without over-burdening them.

### Required Electives Optimization
For required individual rotations (Cards, Onc, etc.), the scheduler uses a **Multi-Pass Minimize Overlap** strategy:
*   **Pass 1**: Iterates through all weeks and attempts to assign residents only to weeks where the rotation is currently empty (Concurrency = 1).
*   **Pass 2**: Iterates again to fill remaining requirements, allowing overlap up to the maximum limit (usually 2 or 3).
*   This ensures that required rotations are distributed as evenly as possible across the year, reducing the chance of multiple residents being on the same specialist service simultaneously unless necessary.

## 4. Gaps & Electives
*   Any week left unassigned after all mandatory and required rotations are processed is automatically filled with **Generic Elective**.

## 5. Team Diversity
*   The system tracks co-working relationships.
*   While not a hard constraint during generation, the `Relationship Stats` tab monitors diversity to ensure residents work with a broad mix of colleagues rather than forming cliques.

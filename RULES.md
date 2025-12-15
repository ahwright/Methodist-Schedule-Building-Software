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
| **Emergency** | 2 Weeks | 1 | 2 | 1 | 2 | |

## 3. Assignment Logic

### General Block Assignment
1.  **Availability Check**: Residents must be free for the full duration of the block (e.g., 4 contiguous weeks).
2.  **Clinic Conflict**: A block cannot be assigned if it overlaps with a mandatory Clinic week, unless the rotation specifically allows interruption (currently, most 4-week blocks try to fit *between* clinic weeks or the logic handles gaps).
3.  **Prioritization**:
    *   Residents with fewer assigned weeks of that specific rotation type are prioritized (Load Balancing).
    *   Residents with specific "Avoid" constraints with currently assigned team members are deprioritized.

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

### Fallbacks
*   If a full 4-week block cannot be placed (e.g., due to spacing or availability), the scheduler attempts to place smaller chunks (3, 2, or 1 week) to maintain minimum hospital coverage.

## 4. Gaps & Electives
*   Any week left unassigned after all mandatory rotations are processed is automatically filled with **Elective**.

## 5. Team Diversity
*   The system tracks co-working relationships.
*   While not a hard constraint during generation, the `Relationship Stats` tab monitors diversity to ensure residents work with a broad mix of colleagues rather than forming cliques.

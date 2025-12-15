# Scheduling Rules & Constraints

This document outlines the logic and constraints used by the **Residency Scheduler Pro** algorithm.

## 1. The 4+1 Model (Cohorts)
*   **Structure**: Residents are divided into 5 cohorts (0-4), corresponding to groups A through E.
*   **Clinic Weeks**: Every 5th week is a guaranteed **Clinic (CCIM)** week.
    *   *Formula*: `Week % 5 == Cohort ID`
    *   *Constraint*: Clinic weeks are fixed and cannot be overwritten by other rotations.

## 2. Rotation Requirements

The scheduler attempts to fill shifts based on the following minimum and maximum staffing requirements per week.

| Rotation | Duration | Min Interns | Max Interns | Min Seniors | Max Seniors | Total Team Size |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Night Float** | 4 Weeks | 1 | 2 | 1 | 3 | 2 - 5 |
| **ICU** | 4 Weeks | 2 | 2 | 2 | 2 | 4 |
| **Wards (Red)** | 4 Weeks | 2 | 3 | 1 | 2 | 3 - 5 |
| **Wards (Blue)** | 4 Weeks | 2 | 3 | 1 | 2 | 3 - 5 |
| **Emergency** | 2 Weeks | 1 | 2 | 0 | 2 | 1 - 4 |

### PGY1 Required Electives
In addition to the above, Interns (PGY1) are required to complete the following electives.

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
3.  **Prioritization & Phased Loading**:
    The algorithm runs in distinct phases to protect critical constraints and ensure required electives are not blocked by flexible rotations.

    *   **Phase 1: Minimum Coverage Guarantee**:
        Fills **Wards, ICU, and Emergency Medicine** to their *minimum* required staffing levels. This ensures that flexible rotations (like Wards with 1-3 interns) do not consume all available interns before stricter constraints (EM min 1) are met.
    
    *   **Phase 2: Long Required Electives (4 Weeks)**:
        Fills 4-week blocks (Cards, Onc, Neuro, Rheum). Because these are long blocks that must fit between Clinic weeks, they are scheduled *before* the schedule becomes fragmented by shorter blocks. The algorithm uses a **concurrency pass** (filling 1 slot per week first) to minimize overlap.
    
    *   **Phase 3: Short Required Electives (2 Weeks)**:
        Fills remaining 2-week requirements (PGY1 ID/Neph/Pulm, PGY3 Reqs). This phase also uses a concurrency-check loop to actively minimize overlap where possible.

    *   **Phase 4: Maximum Capacity Fill**:
        Fills **Wards, ICU, and EM** up to their *maximum* capacity (e.g. up to 5 team members) to balance workload and minimize generic electives.
    
    *   **Phase 5: Flexible Electives**:
        Fills remaining gaps with Generic Electives.

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

## 4. Gaps & Electives
*   Any week left unassigned after all mandatory and required rotations are processed is automatically filled with **Generic Elective**.

## 5. Team Diversity
*   The system tracks co-working relationships.
*   While not a hard constraint during generation, the `Relationship Stats` tab monitors diversity to ensure residents work with a broad mix of colleagues rather than forming cliques.
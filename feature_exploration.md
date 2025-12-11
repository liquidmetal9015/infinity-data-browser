Feature Exploration & Architecture Design
User Request
What do you think it would take to turn this into more of a "multi-page" application? I think that the pages would all rely on the same database but would have largely seperate functionality. These would be in addition to the main page that allows you to search for weapons and equipment.

A page that I might want to include would be one where you can compare unit presence across factions, probably as columns. So a common use would be to select a super faction and you would be able to see side-by-side what units are in each faction and which are common between them. Each row would be a unit and you could see what is shared. I feel like there might be a way to show some kind of connection graph there, where you could filter for super-factions or sectorials and see how much they are sharing. That could potentially be a different tab though. There could be a simple connections graph between the factions; but there could also be some kind of graph where each unit is a node, and it's connected to each faction that it's a part of, you could then have like connection forces such that they would get pulled towards factions that they are a part of.

I'd like to be able to have a page that could make fireteams more clear and/or allow you to build fireteams and see what level they would be. That could get a bit complex. It could even just be a unit listing that allows you to see which fireteams each unit can go into and to filter like that.

A page that I would like would be a way to visualize the range bands of weapon combinations. So each weapon has range bands, and it would be good to understand if I have weapons A, B, and C how do those range bands interact. So seeing them next to each other and then seeing like a max function of their range bands together would be good.

I think a page that just has a big list of all the different equipment, weapons, and skills and their varients and shows some examples of units that have them would be useful. Along with how many units in the game have them.

So I know that this is a lot, maybe you can do a write up on the principle question, and then also investigate each of these ideas and write them up into an .md document explaining each idea and it's feasability. Why don't you also include this prompt word for word in that file just so that I have it.

Architecture: Multi-Page Application
Transition Strategy
Transitioning to a multi-page application is highly feasible and strongly recommended for the scope of features requested. The current "Single Page Application" (SPA) structure can be easily extended using React Router.

Key Architectural Components:

Routing (React Router DOM): This library will manage navigation between different "pages" (Views). Each feature (Unit Search, Faction Compare, etc.) will have its own route (e.g., /, /compare, /fireteams).
Shared State (DatabaseContext): We have already established DatabaseContext. This is the perfect foundation. By wrapping the Router in the 
DatabaseProvider
, the db instance—once initialized—will be available instantly to every page without reloading or re-fetching data.
Layout Wrapper: A common Layout component will hold the 
DatabaseProvider
 and a persistent Navigation bar (tabs or sidebar) to switch between views.
Feasibility: High. This is a standard React pattern. Effort: Low/Medium. Setting up the router is quick; the effort lies in building the new pages.

Feature 1: Faction Comparison & Connection Graph
Concept
A tool to visualize unit availability across different factions, specifically Sectorials within a "Super Faction" (e.g., PanOceania vs. Varuna vs. WinterForce).

Visualization Ideas
Matrix View (Table): Rows = Units, Columns = Factions. Checks marks indicate availability.
Force-Directed Graph:
Nodes: Factions (Large nodes) and Units (Small nodes).
Links: Lines connecting a Unit to every Faction it belongs to.
Physics: Units shared by factions will naturally be pulled between them, clustering "shared" units in the middle and "unique" units on the periphery.
Feasibility Analysis
Data Availability: High. We have unit.factions (array of IDs) and metadata.factions. We can easily compute the intersection.
Technical Complexity: Medium.
The Table View is trivial to implement.
The Graph View requires a visualization library like react-force-graph or D3.js. While complex to build from scratch, libraries make this very achievable.
Performance: Handling ~50 nodes (units in a faction) is fast. Handling all ~1000 units at once might be busy, so filtering by "Super Faction" (as suggested) is a smart constraint.
Feature 2: Fireteam Builder / Visualizer
Concept
A tool to understand Fireteam composition rules: which units can form teams together (Core, Haris, Duo) and what bonuses they get.

Feasibility Analysis
Data Availability: Unknown / Investigation Needed. Fireteam data is notoriously complex in Infinity (Wildcards, "Counts As", special compositions). We need to verify if the 
json
 data contains explicit fireteam tags or if we need to derive this from "Notes" or separate data sources.
Risk: If the data isn't structured (e.g., just plain text strings), parsing it reliable is difficult.
Technical Complexity: High.
Builder: Implementing the validation logic for valid fireteams (e.g., "up to 5 members," "must include 1...," "Wildcard limits") is a complex logic puzzle.
Visualizer: A simple listing ("This unit can join: Core in Varuna, Duo in WinterFor") is much easier and a good "Level 1" implementation.
Recommendation
Start with the Unit Fireteam Reference (listing what teams a unit can join) before attempting a full Builder.

Feature 3: Weapon Range Visualizer
Concept
Visualizing the "Effective Range" of a unit's loadout. Comparing bands (0-8", 8-16", etc.) and modifiers (+3, 0, -3, -6).

Implementation
Combined Graph: A chart where the X-axis is Distance (Inches). The Y-axis is the Modifier.
We can plot multiple lines (Weapon A, Weapon B) to see overlaps.
"Max Function": A "Best Case" line showing the optimal modifier at any given range.
Feasibility Analysis
Data Availability: High. metadata.weapons or unit.weapons likely contains the range band dictionaries.
Technical Complexity: Low. This is a great candidate for a simple SVG chart or a library like recharts.
Value: High. This provides immediate tactical insight that is hard to glean from just reading numbers.
Feature 4: Reference Library (The Encyclopedia)
Concept
A browseable catalog of all Equipment, Weapons, and Skills, independent of specific units.

Features
List View: Searchable list of all items.
Detail View: Clicking an item shows its rules (if available in text), stats, and a list of "Who has this?" (Units with this item).
Statistics: "Used by 15% of units."
Feasibility Analysis
Data Availability: High. 
metadata.json
 lists these categories. We can iterate through the entire unit database to generate the "Who has this?" lists dynamically on load.
Technical Complexity: Low. This is primarily list rendering and filtering.
Summary & Roadmap Proposal
Phase 1: Foundation (Architecture)

Install react-router-dom.
Create Layout and NavBar.
Move current search to SearchPage.
Phase 2: The Encyclopedia (Reference Lib)

Easiest to implement.
Good for testing the multi-page structure.
Phase 3: Range Visualizer

Self-contained component.
High "wow" factor for low effort.
Phase 4: Faction Analytics (Comparison)

Table view first.
Graph view as a "Stretch Goal" or V2.
Phase 5: Fireteams

Requires deep data investigation first.
Start with simple listings.
Here we want to develop a web application that will allow a user to explore infinity army data. The version of the data that we are working with is in the data folder.

The data is described to some extent in the DATA_STRUCTURE.md. The first thing we did was create a script for identifying which .json file is for which faction as well as renaming each of the faction .json files. This is in the audit_and_rename.py file as well as the identify_factions.py file.

We then created a basic proof of concept in python that works from the command-line and queries and uses a basic python library that we have created in infinity_tools, the script for querying is in query_infinity.py

After that basic proof of concept we pivoted to a web application. The idea is to create a single page react app with everything client side. For right now we are sending the raw data as individual files I believe, but it seems to me like it might be possible or make sense to minify and/or combine the data at some point for efficiency.

The current web application prototype is currently located in the web directory.

This application is currently... I'll say very bad and totally unusable.

It has three seperate search bars for equipment, weapons, and skills that are the full width of the page. They function on an "Includes" basis which is not inherently a problem, but right now they update each time you type a character into the interface which causes the entire application to freeze and glitch each character you type. 

The overall style and usability of the application is really really bad. The list of results is neither visually dense nor attractive to look at, and it does a bad job of communicating the information that we are looking for.

I'm going to brainstorm some of the properties that we'll want to have in this application:

I think the core of it is this, what questions would a user want to have answered:

1. What units in the game have access to X (skill, equipment, or weapon) (probably also want to know which factions they are in whenever we are looking at a unit)
2. What units in the game have access to X OR Y (each being a skill, equipment, or weapon)
3. What units in the game have access to X AND Y (each being a skill equipment, or weapon)
4. What factions have access to X and what factions do not? What are the units in each faction that grant that access?
5. What is the distribution of X between the factions? What factions have more options for X and which have only a few options? (This feels like it might be an visualization extension or alternative tool rather than a different query)

It seems like a generic query framework could potentially work for many of these. We might also want to understand what units have some condition on a skill as well. I.e. I might want to know which units in the game have over 14 bs and also have a heavy machine gun. So those could be included as query options.

Something that's also very important is that skills and weapons can also have attributes that can totally change how they work. I'm not totally sure about how it works in the data but a unit will have "BS Attack(-3)" and another will have "BS Attack(Continuous Damage)" and those are very different things. Both weapons and skills can also have these modifiers, like "Combat Jump(Deployment Zone)" and "Adhesive Launcher Rifle(+1B)" are common, and it's pretty important to be able to search for things like that specifically.

We would also want to try to make sure that the output of a query is visually dense, so that for most queries even if they have a large number of results you can see all the results without scrolling. Being able to sort the results would also be good. This seems to lead me in the direction of something more like a table rather than cards or other boxes.

We also want it to be sleek and responsive. I will say that with my past web application which was at first implemented in pure JS, and then ported to Svelte. It seemed like the pure JS implementation might have been better overall? It at least seemed a lot more simple and the styling ended up being a lot better although that could easily just be a fluke. We should probably consider the current approach that we are taking though, because I don't really like where it's at visually right now at all (or the functionality but that's a seperate matter).

Additional features that would be nice to have:
- The ability to narrow things down to a subset of factions.
- The ability to filter for specifics types of units (LI, HI, SK, etc)
- The ability to filter or sort units by their points cost
- 

This is really for the future, but an interface that would be really nice would be the ability to visualize the cross-polination of units between factions. I.e. how could you see at a glance which units are available between different factions. Some kind of dynamic visual here, like something with gravity might be nice? Not totally sure, we should probably do an evaluation of what kinds of visualizations might be appropriate for this purpose. 


This is even further in the future, and should probably be a seperate tool, but it would be interesting to try to infer where the points costs of units are coming from. I.e. what stats, weapons, skills, and equipment do we estimate are contributing to the cost of this unit. I think this should probably be shelved for right now.



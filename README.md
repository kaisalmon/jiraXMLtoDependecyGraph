# jiraXMLtoDependecyGraph
By Mr. Salmon [fish emoji]


1. In jira search for all issues in an epic with this: 
`("Epic Link" IN (DEV-5412)) OR (issuetype = sub-task AND "parentEpic" IN (DEV-5412))` 
where `DEV-5412` is the ticket of the epic.

2. export as xml

3. Modify the line `/FiltersetProject-2020-15-08.xml' to be the path to the xml

4. Copy paste the output here https://dreampuf.github.io/GraphvizOnline/

fs = require('fs');
var parser = require('xml2json');

const PREAMBLE = `
digraph G {
    node [shape=plaintext,style=filled, fontname="Helvetica"];
    size="1!, 1!";
   ratio="compress"
    START [label=<
        <table border="0" cellborder="0" cellspacing="0">
            <tr><td>START</td></tr>
        </table>
    >, shape=diamond];



`

const POSTAMBLE = `
}
`

const issuelinksToBlocks = (issuelinks) => {
    if(!issuelinks) return [];
    const linksArray = Array.isArray(issuelinks) ? issuelinks : [issuelinks];
    const outwardBlockLinks = linksArray
        .filter(({name}) => name === 'Blocks')
        .filter(({outwardlinks}) => outwardlinks);


    return outwardBlockLinks.flatMap(({outwardlinks}) => {
        const outwardlinksArray = Array.isArray(outwardlinks.issuelink) ? outwardlinks.issuelink : [outwardlinks.issuelink];
        return (outwardlinksArray.map(x=>x.issuekey.$t))
    });
}

const issueToSubtasks = (issue) => {
    if(!issue) return [];
    const subtasks = issue?.subtasks?.subtask;
    if (!subtasks) return [];
    const subtasksArray = Array.isArray(subtasks) ? subtasks : [subtasks];
    return subtasksArray.map(x=>x.$t);
}
fs.readFile( './jiraExports/18-8-2022.xml', function(err, data) {
    var {rss: {channel:{item}}} = JSON.parse(parser.toJson(data));
    let issues = item.map(issue => {
        return {
            id: issue.link.split('/').pop(),
            title: issue.link.split('/').pop()+'<br/>'+addNewLineEveryNCharactersAfterWord(issue.title.split(']').pop()+'<br/><b>'+issue.status.$t+'</b>', 20),
            blocks: issuelinksToBlocks(issue.issuelinks?.issuelinktype),
            subtasks: issueToSubtasks(issue),
            //color: ['Done', 'Resolved'].includes(issue.status.$t) ? '#e3fcef' : 
            color: ['Done', 'Resolved','Ready to final approval'].includes(issue.status.$t) ? '#e3fcef' : 
                    ['In Progress', 'Ready for Dev review', 'Ready to final approval', 'In code review'].includes(issue.status.$t) ? '#deebff' :
                    '#dddddd',
            //fontcolor: ['Done', 'Resolved'].includes(issue.status.$t) ? '#006644' : 
            fontcolor: ['Done', 'Resolved','Ready to final approval'].includes(issue.status.$t) ? '#006644' : 
                    ['In Progress', 'Ready for Dev review', 'Ready to final approval', 'In code review'].includes(issue.status.$t) ? '#0747a6' :
                    '#000000'
        }
    })

    issues = createVirtualIssues(issues)
    
    let output = `
        ${PREAMBLE}
        ${getNodesString(issues)}
        ${getEdgesString(issues)}
        ${POSTAMBLE}
    `;

    output = removeDoubleNewlines(output);

    console.log(output);

 });

 const getNodesString = (issues) => {
    return issues.map(issue => {
        return `
            "${issue.id}" [
                label=<
                    <table border="0" cellborder="0" cellspacing="0">
                        <tr><td>${issue.title}</td></tr>
                    </table>
                >
                color="${issue.color}"
                fontcolor="${issue.fontcolor}"
                ${issue.shape ? `shape="${issue.shape}"` : ''}
            ];
        `
    }
    ).join('\n');
}

const getEdgesString = (issues) => {
    const blocksEdges =  issues.map(issue => {
        return issue.blocks.map(block => {
            return `
                "${issue.id}" -> "${block}";
            `
        }
        ).join('\n');
    }
    ).join('\n');

    const subtasksEdges = issues.map(issue => {
        return issue.subtasks.map(subtask => `
                "${subtask}" -> "${issue.id}" [style="dotted"];
            `
        ).join('\n');
    }).join('\n');

    const startIssues = issues.filter(issue => !issues.some(x => x.blocks.includes(issue.id)))

    const startEdges = startIssues.map(issue => {
        return `
            START -> "${issue.id}";
        `
    }).join('\n');


    return blocksEdges + '\n' + subtasksEdges + '\n' + startEdges ;
}

const removeDoubleNewlines = (str) => {
    return str.replace(/\n+/g, '\n');
}

function createVirtualIssues(issues){
    const blockedBys = issues.map(issue => {
        return issues.filter(x => x.blocks.includes(issue.id))
            .map(x => x.id)
    });
    const blockBysCounts = blockedBys.filter(x=>x.length>=2).reduce((acc, curr) => {
        curr = JSON.stringify(curr);
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
    }, {})
    const virtualTasks = Object.keys(blockBysCounts).filter(x=>blockBysCounts[x]>1).map(x=>JSON.parse(x));
    const virtualIssues = virtualTasks.map(task => ({
        id: `virtual-${task.join('-')}`,
        title: '',
        color: '#dddddd',
        shape: 'circle',
        blocks: issues.filter(issue => {
            const blockedBy = issues.filter(x => x.blocks.includes(issue.id));
            return blockedBy.length === task.length && blockedBy.every(x => task.includes(x.id));
        }).map(x => x.id),
        subtasks: []
    }))
    virtualTasks.forEach(task => {
        task.forEach(id => {
            const issue = issues.find(x => x.id === id);
            issue.blocks = [`virtual-${task.join('-')}`, ...issue.blocks];
        })
    });
   
    /* Any issue which blocks a virtual issue, shouldn't block it's children */
    issues.forEach(issue => {
        const blockedVirtualIssues = issue.blocks.filter(x => x.startsWith('virtual-'));
        const vGrandChildren = blockedVirtualIssues.map(id=>virtualIssues.find(x=>x.id===id)).flatMap(x=>x.blocks);
        issue.blocks = issue.blocks.filter(x => !vGrandChildren.includes(x));
    })

    return [...virtualIssues, ...issues];
}

const addNewLineEveryNCharactersAfterWord = (str, n)=>{
    let count = 0;
    let newStr = '';
    for(let i = 0; i < str.length; i++){
        if(str[i] !== ' '){
            newStr += str[i];
            count++;
            continue
        }
        if(count >= n){
            newStr += '<br/>';
            count = 0;
        }
        newStr += str[i];
    }
    return newStr;
}

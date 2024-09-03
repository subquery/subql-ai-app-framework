import ollama from "ollama";

async function run(){
    const r = await ollama.embed({
        model: 'nomic-embed-text',
        input: 'What is SubQuery Network?',
    })

    console.log(JSON.stringify(r))
}

run();
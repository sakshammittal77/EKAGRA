import wikipedia

def get_educational_context(topic: str) -> dict:
    """
    Retrieves educational context from Wikipedia for the given topic.
    In a full production app, this would query a Vector DB (like Pinecone or Qdrant) 
    filled with Khan Academy, OpenStax, MIT OCW content.
    """
    try:
        # Search for the best matching page
        search_results = wikipedia.search(topic, results=1)
        if not search_results:
            return {"context": "No information found.", "sources": []}
            
        page = wikipedia.page(search_results[0], auto_suggest=False)
        
        # Get the summary and maybe a bit more content
        context = page.summary
        
        return {
            "context": context,
            "sources": [page.url]
        }
    except Exception as e:
        print(f"Error fetching context for {topic}: {e}")
        return {"context": f"Could not retrieve specific facts due to error. Provide a general teaching on {topic}.", "sources": []}

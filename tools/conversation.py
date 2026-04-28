def start_conversation():
    """Starts a conversation with the user and the assistant, so the user doesnt have to say "echo" every time to talk to the assistant
    """
    global conversation_mode
    conversation_mode = True

def end_conversation():
    """Ends the conversation with the user and the assistant whenever the conversation ended, that way the user has to say echo to talk to the assistant
    """
    global conversation_mode
    conversation_mode = False

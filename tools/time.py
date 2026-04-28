from datetime import datetime

def get_time():
    """Get the current local time of the system

    Returns:
        The current time in the format "HH:MM:SS"
    """
    now = datetime.now()
    return now.strftime("%H:%M:%S")

def get_date():
    """Get the current local date of the system

    Returns:
        The current date in the format "YYYY-MM-DD"
    """
    now = datetime.now()
    return now.strftime("%Y-%m-%d")
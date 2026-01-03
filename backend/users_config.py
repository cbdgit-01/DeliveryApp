"""
User Configuration
==================
Add, edit, or remove users here. Changes take effect when you restart the backend.

Roles:
  - admin: Full access (dashboards, calendar, scheduling, all actions)
  - staff: Can only create new deliveries/pickups

To add a new user, copy an existing entry and modify it.
To remove a user, delete or comment out their entry.
"""

USERS = [
    {
        "username": "admin",
        "password": "admin123",
        "role": "admin",
        "full_name": "Administrator",
    },
    {
        "username": "staff",
        "password": "staff123",
        "role": "staff",
        "full_name": "Store Staff",
    },
    # Add more users below:
    # {
    #     "username": "john",
    #     "password": "john123",
    #     "role": "staff",
    #     "full_name": "John Smith",
    # },
]


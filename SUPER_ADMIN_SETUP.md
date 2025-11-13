# Super Admin Panel Setup Guide

## Overview
The super admin panel provides system-wide management capabilities including:
- View all families and their statistics
- Manage subscription plans (Free, Basic, Premium, Custom)
- Assign plans to families
- Configure module access per plan or per family (custom plans)
- View system-wide statistics

## Initial Setup

### Step 1: Find Your User ID

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run this query to find your user ID:

```sql
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
```

Replace `your-email@example.com` with your actual email address.

### Step 2: Grant Super Admin Access

Copy your user ID from the previous step, then run:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_USER_ID_HERE', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Replace `YOUR_USER_ID_HERE` with your actual user ID (it will look like `123e4567-e89b-12d3-a456-426614174000`).

### Step 3: Access the Super Admin Panel

1. Log into your application
2. Navigate to: `https://your-app-url.com/super-admin`
3. You should now see the Super Admin dashboard

## Features

### Dashboard (`/super-admin`)
- Total families count
- Total users across all families
- Active families in last 30 days
- System-wide task, event, list, and reward counts
- Plan distribution breakdown

### Family Management (`/super-admin/families`)
- View all families with detailed statistics
- See member count, activity streaks, task/event/list counts
- Assign subscription plans to families
- Configure custom module access for specific families
- View all family members with their details

### Plan Management (`/super-admin/plans`)
- Create new subscription plans
- Edit existing plans
- Configure which modules are included in each plan
- View number of families on each plan

## Subscription Plans

### Default Plans

**Free Plan:**
- Tasks ✅
- Lists ✅
- Calendar ❌
- Rewards ❌
- Rotating Tasks ❌
- Screensaver ❌

**Basic Plan:**
- Tasks ✅
- Lists ✅
- Calendar ✅
- Rewards ✅
- Rotating Tasks ❌
- Screensaver ❌

**Premium Plan:**
- All modules enabled ✅

**Custom Plan:**
- Special plan type that allows per-family module overrides
- Assign to families that need custom configurations
- Configure modules individually for each family

## Available Modules

1. **Tasks** - Task management and completion tracking
2. **Calendar** - Event scheduling and calendar management
3. **Lists** - Shopping lists and to-do lists
4. **Rewards** - Points and rewards system
5. **Rotating Tasks** - Automatic task rotation among members
6. **Screensaver** - Custom screensaver with photos

## Security

- Super admin access is verified at the database level using `SECURITY DEFINER` functions
- Only users with the `super_admin` role in the `user_roles` table can access the panel
- All queries are protected by Row-Level Security (RLS) policies
- No client-side role storage (secure by design)

## Troubleshooting

### "Access Denied" Message
- Verify you ran the SQL commands correctly
- Check that your user_id matches exactly (no extra spaces)
- Ensure you're logged in with the correct account
- Clear browser cache and try again

### Can't See Super Admin Menu
- The super admin panel is separate from the regular admin panel
- Access it directly at `/super-admin` route
- Regular family admins cannot see or access this panel

### Plan Changes Not Reflecting
- Changes may take a few seconds to propagate
- Try refreshing the page
- Check browser console for any errors

## Support

For issues or questions, check the application logs in Supabase:
1. Go to your Supabase dashboard
2. Navigate to **Logs** → **Database**
3. Look for any errors related to super_admin functions

## Important Notes

- ⚠️ **The "Custom" plan is a system plan and cannot be deleted**
- ⚠️ **Only grant super admin access to trusted users**
- ⚠️ **Super admins have full system access across all families**
- 💡 **Use custom plans sparingly for special cases only**
- 💡 **Most families should use predefined plans (Free/Basic/Premium)**

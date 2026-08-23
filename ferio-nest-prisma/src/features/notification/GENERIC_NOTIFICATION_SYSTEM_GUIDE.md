# 📚 **GENERIC NOTIFICATION SYSTEM - USAGE GUIDE**

**Date**: 17-03-26  
**Status**: ✅ **COMPLETE**  
**Pattern**: Generic, Decoupled, Reusable

---

## 🎯 **OVERVIEW:**

This is a **generic notification system** that can be used from **any module**:
- ✅ Task module (task created, updated, completed)
- ✅ Chat module (new message, conversation update)
- ✅ Subscription module (payment success, renewal)
- ✅ User module (welcome, profile update)
- ✅ System module (announcements, maintenance)
- ✅ **Any future module!**

---

## 📁 **ARCHITECTURE:**

```
NotificationModule
├── NotificationService          # Core service (generic)
├── NotificationController       # REST API endpoints
├── NotificationSchema           # MongoDB schema
├── dto/
│   ├── SendNotificationDto      # For sending notifications
│   ├── EnqueueNotificationDto   # For async processing
│   └── BroadcastNotificationDto # For broadcasting
└── notification.constants.ts    # Constants
```

---

## 🔥 **USAGE EXAMPLES:**

### **Example 1: From Task Module**

```typescript
// In task.service.ts
import { NotificationService } from '../notification.module/notification.service';
import { NotificationType } from '../notification.module/notification.schema';

@Injectable()
export class TaskService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private notificationService: NotificationService,  // ← Inject!
  ) {}

  async createTask(createTaskDto: CreateTaskDto, userId: string) {
    // Create task
    const task = await this.taskModel.create({
      ...createTaskDto,
      createdById: userId,
    });

    // Send notification to assigned users
    if (createTaskDto.assignedUserIds) {
      for (const assignedUserId of createTaskDto.assignedUserIds) {
        await this.notificationService.sendNotification({
          title: 'New Task Assigned',
          message: `You have been assigned to task: ${task.title}`,
          senderId: userId,
          receiverId: assignedUserId,
          type: NotificationType.ASSIGNMENT,
          entityType: 'task',
          entityId: task._id.toString(),
          linkFor: '/tasks',
          linkId: task._id.toString(),
        });
      }
    }

    return task;
  }
}
```

---

### **Example 2: From Chat Module**

```typescript
// In message.service.ts
import { NotificationService } from '../notification.module/notification.service';
import { NotificationType } from '../notification.module/notification.schema';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private notificationService: NotificationService,
  ) {}

  async sendMessage(messageData: SendMessageDto, senderId: string) {
    // Create message
    const message = await this.messageModel.create({
      ...messageData,
      senderId,
    });

    // Send notification to receiver
    if (messageData.receiverId !== senderId) {
      await this.notificationService.sendNotification({
        title: 'New Message',
        message: messageData.text.substring(0, 100),
        senderId,
        receiverId: messageData.receiverId,
        type: NotificationType.CUSTOM,
        entityType: 'conversation',
        entityId: messageData.conversationId,
        linkFor: '/chat',
        linkId: messageData.conversationId,
      });
    }

    return message;
  }
}
```

---

### **Example 3: From Subscription Module**

```typescript
// In subscription.service.ts
import { NotificationService } from '../notification.module/notification.service';
import { NotificationType } from '../notification.module/notification.schema';

@Injectable()
export class SubscriptionService {
  constructor(
    private notificationService: NotificationService,
  ) {}

  async onPaymentSuccess(userId: string, paymentData: PaymentData) {
    // Send payment success notification
    await this.notificationService.sendNotification({
      title: 'Payment Successful',
      message: `Your subscription has been renewed for ${paymentData.planName}`,
      type: NotificationType.SYSTEM,
      receiverId: userId,
      entityType: 'subscription',
      entityId: paymentData.subscriptionId,
      linkFor: '/subscription',
      linkId: paymentData.subscriptionId,
    });
  }
}
```

---

### **Example 4: Async Notification (BullMQ)**

```typescript
// For non-urgent notifications, use async queue
await this.notificationService.enqueueNotification({
  title: 'Weekly Report Ready',
  message: 'Your weekly task report is ready to view',
  type: NotificationType.SYSTEM,
  receiverId: userId,
  entityType: 'report',
  entityId: reportId,
  linkFor: '/reports',
}, 3600000); // Delay: 1 hour
```

---

### **Example 5: Broadcast to Multiple Users**

```typescript
// Broadcast to specific users
await this.notificationService.broadcastNotification({
  title: 'System Maintenance',
  message: 'System will be down for maintenance on Sunday 2 AM',
  type: NotificationType.SYSTEM,
  receiverIds: ['user1', 'user2', 'user3'],
});

// Broadcast to role
await this.notificationService.broadcastNotification({
  title: 'Admin Announcement',
  message: 'New feature released!',
  type: NotificationType.SYSTEM,
  broadcastToRole: 'admin',
});

// Broadcast to all users
await this.notificationService.broadcastNotification({
  title: 'Welcome 2026!',
  message: 'Happy New Year from our team',
  type: NotificationType.SYSTEM,
  broadcastToAll: true,
});
```

---

## 📊 **NOTIFICATION TYPES:**

```typescript
export enum NotificationType {
  TASK = 'task',           // Task-related (created, updated, completed)
  GROUP = 'group',         // Group/team activities
  SYSTEM = 'system',       // System announcements
  REMINDER = 'reminder',   // Reminders
  MENTION = 'mention',     // User mentions
  ASSIGNMENT = 'assignment', // Task assignments
  DEADLINE = 'deadline',   // Deadline warnings
  CUSTOM = 'custom',       // Custom notifications (chat, etc.)
}
```

---

## 🎯 **PRIORITY LEVELS:**

```typescript
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}
```

---

## 📱 **REAL-TIME DELIVERY:**

Notifications are delivered in real-time via Socket.IO:

```typescript
// Client-side (Socket.IO)
socket.on('notification::userId', (notification) => {
  console.log('New notification:', notification);
  // Show toast, update badge, etc.
});

socket.on('notification:unread-count::userId', (data) => {
  console.log('Unread count:', data.count);
  // Update badge count
});
```

---

## 🔧 **REST API ENDPOINTS:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | Get user's notifications |
| GET | `/notifications/unread/count` | Get unread count |
| POST | `/notifications/:id/read` | Mark as read |
| POST | `/notifications/read-all` | Mark all as read |
| DELETE | `/notifications/:id` | Delete notification |
| POST | `/notifications/send` | Send notification |
| POST | `/notifications/enqueue` | Enqueue for async |
| POST | `/notifications/broadcast` | Broadcast (admin) |

---

## 📊 **REDIS CACHING:**

Unread counts are cached in Redis for performance:

```typescript
// Key format
`notification:unread:${userId}`

// TTL: 5 minutes
// Auto-incremented on new notification
// Auto-decremented on mark as read
```

---

## 🎯 **BEST PRACTICES:**

### **1. Use Async Queue for Non-Urgent**
```typescript
// ✅ Good: Urgent (real-time)
await notificationService.sendNotification({
  title: 'New Message',
  type: NotificationType.CUSTOM,
});

// ✅ Good: Non-urgent (async)
await notificationService.enqueueNotification({
  title: 'Weekly Report',
  type: NotificationType.SYSTEM,
}, 3600000); // 1 hour delay
```

### **2. Use Appropriate Types**
```typescript
// Task assignment → NotificationType.ASSIGNMENT
// Task deadline → NotificationType.DEADLINE
// Chat message → NotificationType.CUSTOM
// System announcement → NotificationType.SYSTEM
```

### **3. Include Entity Metadata**
```typescript
// Always include entityType and entityId for deep linking
await notificationService.sendNotification({
  title: 'Task Updated',
  entityType: 'task',
  entityId: taskId,
  linkFor: '/tasks',
  linkId: taskId,
});
```

### **4. Handle Broadcast Carefully**
```typescript
// ✅ Good: Targeted broadcast
await notificationService.broadcastNotification({
  title: 'Admin Update',
  broadcastToRole: 'admin',
});

// ❌ Bad: Broadcasting to all users frequently
// Don't spam all users!
```

---

## ✅ **SUMMARY:**

This notification system is:
- ✅ **Generic** - Works for any module
- ✅ **Decoupled** - No dependencies on specific modules
- ✅ **Scalable** - BullMQ for async processing
- ✅ **Real-Time** - Socket.IO delivery
- ✅ **Cached** - Redis for unread counts
- ✅ **Type-Safe** - Full TypeScript
- ✅ **Documented** - Complete API docs

**Ready to use from any module!** 🚀

---
-17-03-26

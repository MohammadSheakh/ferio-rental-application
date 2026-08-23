# 📚 **GENERIC CONTROLLER & SERVICE GUIDE**

**NestJS Implementation** | Express → NestJS Migration

---

## 🎯 **Purpose**

Provide reusable, type-safe CRUD operations across all modules, following the same pattern as the Express.js backend.

---

## 📁 **File Structure**

```
src/common/
├── base/
│   └── base.entity.ts           # Base entity interface
├── generic/
│   ├── generic.service.ts       # Generic service (CRUD operations)
│   └── generic.controller.ts    # Generic controller (REST endpoints)
└── pipes/
    └── parse-object-id.pipe.ts  # ObjectId validation
```

---

## 📚 **EXPRESS → NESTJS TRANSITION**

### **Express Pattern**:

```typescript
// Generic Service
export class GenericService<T extends Model, K extends Document> {
  constructor(model: T) {
    this.model = model;
  }

  async getById(id: string, populateOptions?: any, select?: string) {
    return await this.model.findById(id).populate(populateOptions).select(select).lean();
  }

  // ... more methods
}

// Generic Controller
export class GenericController<T extends Model, K extends Document> {
  constructor(service: GenericService<T, K>, modelName: string) {
    this.service = service;
    this.modelName = modelName;
  }

  getById = catchAsync(async (req: Request, res: Response) => {
    const result = await this.service.getById(req.params.id);
    sendResponse(res, { code: 200, data: result });
  });
}

// Usage
export class UserService extends GenericService<typeof User, IUser> {
  constructor() {
    super(User);
  }
}

export class UserController extends GenericController<typeof User, IUser> {
  constructor() {
    super(new UserService(), 'User');
  }
}
```

### **NestJS Pattern**:

```typescript
// Generic Service
@Injectable()
export class GenericService<TModel extends Model<TDocument>, TDocument extends IBaseEntity> {
  constructor(protected model: TModel) {}

  async findById(id: string, populateOptions?: any, select?: string) {
    return await this.model.findById(id).populate(populateOptions).select(select).lean().exec();
  }

  // ... more methods
}

// Generic Controller
@Controller()
export class GenericController<TModel extends Model<TDocument>, TDocument extends IBaseEntity> {
  constructor(protected service: GenericService<TModel, TDocument>, protected modelName: string) {}

  @Get(':id')
  async getById(@Param('id') id: string) {
    return await this.service.findById(id);
  }
}

// Usage
@Injectable()
export class UserService extends GenericService<typeof User, UserDocument> {
  constructor(@InjectModel('User') userModel: Model<UserDocument>) {
    super(userModel);
  }

  // Custom methods
  async findByEmail(email: string) {
    return this.model.findOne({ email }).exec();
  }
}

@Controller('users')
export class UserController extends GenericController<typeof User, UserDocument> {
  constructor(private userService: UserService) {
    super(userService, 'User');
  }

  // Custom endpoints
  @Get('me')
  async getCurrentUser(@User() user: UserPayload) {
    return this.userService.findById(user.userId);
  }
}
```

---

## 🔧 **KEY DIFFERENCES**

| Aspect | Express.js | NestJS |
|--------|-----------|--------|
| **Service** | Manual model injection | `@InjectModel()` DI |
| **Controller** | Manual route handlers | Decorators (`@Get`, `@Post`) |
| **Request** | `req.params.id` | `@Param('id')` |
| **Response** | `sendResponse(res, {...})` | Automatic (return value) |
| **Validation** | Manual or Zod | Pipes (`ParseObjectIdPipe`) |
| **Type Safety** | Partial (TypeScript) | Full (Generics + TypeScript) |

---

## 💡 **USAGE EXAMPLES**

### **Example 1: Simple Module (No Custom Logic)**

```typescript
// user.schema.ts
@Schema({ timestamps: true })
export class User extends IBaseEntity {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// user.service.ts
@Injectable()
export class UserService extends GenericService<typeof User, UserDocument> {
  constructor(@InjectModel('User') userModel: Model<UserDocument>) {
    super(userModel);
  }
}

// user.controller.ts
@Controller('users')
@ApiTags('Users')
export class UserController extends GenericController<typeof User, UserDocument> {
  constructor(private userService: UserService) {
    super(userService, 'User');
  }
}

// user.module.ts
@Module({
  imports: [MongooseModule.forFeature([{ name: 'User', schema: UserSchema }])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

**Result**: Automatic CRUD endpoints:
- `GET /users` - Get all users
- `GET /users/:id` - Get user by ID
- `GET /users/paginate` - Get users with pagination
- `POST /users` - Create user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user
- `DELETE /users/:id/soft` - Soft delete user
- `GET /users/count` - Count users

---

### **Example 2: Module with Custom Logic**

```typescript
// task.service.ts
@Injectable()
export class TaskService extends GenericService<typeof Task, TaskDocument> {
  constructor(@InjectModel('Task') taskModel: Model<TaskDocument>) {
    super(taskModel);
  }

  // Custom method: Get tasks by user
  async getTasksByUserId(userId: string, status?: string) {
    const filters: any = {
      $or: [{ ownerUserId: userId }, { assignedUserIds: userId }],
      isDeleted: false,
    };

    if (status) {
      filters.status = status;
    }

    return this.findAll(filters);
  }

  // Custom method: Get daily progress
  async getDailyProgress(userId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const filters = {
      ownerUserId: userId,
      startTime: { $gte: startOfDay, $lte: endOfDay },
      isDeleted: false,
    };

    return this.findAll(filters);
  }
}

// task.controller.ts
@Controller('tasks')
@ApiTags('Tasks')
export class TaskController extends GenericController<typeof Task, TaskDocument> {
  constructor(private taskService: TaskService) {
    super(taskService, 'Task');
  }

  // Custom endpoint: Get my tasks
  @Get('my')
  @UseGuards(AuthGuard)
  async getMyTasks(@User() user: UserPayload, @Query('status') status?: string) {
    return await this.taskService.getTasksByUserId(user.userId, status);
  }

  // Custom endpoint: Get daily progress
  @Get('daily-progress')
  @UseGuards(AuthGuard)
  async getDailyProgress(
    @User() user: UserPayload,
    @Query('date') date?: string,
  ) {
    const targetDate = date ? new Date(date) : new Date();
    return await this.taskService.getDailyProgress(user.userId, targetDate);
  }
}
```

---

## 🎯 **AVAILABLE METHODS**

### **Generic Service Methods**:

| Method | Description | Returns |
|--------|-------------|---------|
| `findById(id, populate, select)` | Find by ID | `TDocument \| null` |
| `findAll(filters, populate, select)` | Find all (no pagination) | `TDocument[]` |
| `findAllWithPagination(filters, options, populate, select)` | Find with pagination | `PaginateResult<TDocument>` |
| `create(data)` | Create new document | `TDocument` |
| `updateById(id, data, options)` | Update by ID | `TDocument \| null` |
| `deleteById(id)` | Delete (hard) | `TDocument \| null` |
| `softDeleteById(id)` | Soft delete | `TDocument \| null` |
| `count(filters)` | Count documents | `number` |
| `exists(filters)` | Check if exists | `boolean` |

### **Generic Controller Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:id` | Get by ID |
| GET | `/` | Get all (no pagination) |
| GET | `/paginate` | Get with pagination |
| POST | `/` | Create new |
| PUT | `/:id` | Update by ID |
| DELETE | `/:id` | Delete (hard) |
| DELETE | `/:id/soft` | Soft delete |
| GET | `/count` | Count documents |

---

## 📝 **BEST PRACTICES**

### **1. Extend, Don't Replace**

```typescript
// ✅ GOOD: Extend generic service
@Injectable()
export class UserService extends GenericService<typeof User, UserDocument> {
  constructor(@InjectModel('User') userModel: Model<UserDocument>) {
    super(userModel);
  }

  // Add custom methods
  async findByEmail(email: string) {
    return this.model.findOne({ email }).exec();
  }
}

// ❌ BAD: Create new service from scratch
@Injectable()
export class UserService {
  constructor(@InjectModel('User') userModel: Model<UserDocument>) {
    this.userModel = userModel;
  }

  // Re-implementing CRUD operations (DRY violation)
  async findById(id: string) {
    return this.userModel.findById(id).exec();
  }
}
```

### **2. Use Custom Methods for Business Logic**

```typescript
// ✅ GOOD: Business logic in custom methods
async getDailyProgress(userId: string, date: Date) {
  // Complex date logic
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.findAll({
    ownerUserId: userId,
    startTime: { $gte: startOfDay, $lte: endOfDay },
  });
}

// ❌ BAD: Business logic in controller
@Get('daily-progress')
async getDailyProgress(@Query('date') date: string) {
  // Don't put business logic here
  const startOfDay = new Date(date);
  // ...
}
```

### **3. Override When Necessary**

```typescript
// ✅ GOOD: Override generic method for custom behavior
async softDeleteById(id: string): Promise<TaskDocument | null> {
  // Custom soft delete logic for tasks
  await this.model.updateOne(
    { _id: id },
    {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: this.currentUser.id, // Custom field
    },
  );

  return this.findById(id);
}
```

---

## 🧪 **TESTING**

```typescript
// user.service.spec.ts
describe('UserService', () => {
  let service: UserService;
  let model: Model<UserDocument>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken('User'),
          useValue: {
            findById: jest.fn(),
            findOne: jest.fn(),
            // ... mock other methods
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    model = module.get<Model<UserDocument>>(getModelToken('User'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find user by email', async () => {
    const email = 'test@example.com';
    const user = { _id: '123', email } as UserDocument;

    jest.spyOn(model, 'findOne').mockResolvedValue(user);

    const result = await service.findByEmail(email);
    expect(result).toEqual(user);
  });
});
```

---

## ✅ **SUMMARY**

| Feature | Status |
|---------|--------|
| **Generic Service** | ✅ Complete |
| **Generic Controller** | ✅ Complete |
| **Type Safety** | ✅ Full TypeScript generics |
| **CRUD Operations** | ✅ All covered |
| **Pagination** | ✅ Built-in |
| **Soft Delete** | ✅ Built-in |
| **Custom Methods** | ✅ Easy to extend |
| **Testing** | ✅ Easy to mock |
| **Swagger Docs** | ✅ Auto-generated |

---

**Status**: ✅ **COMPLETE**  
**Ready to Use**: Yes  
**Next**: Update User Module to use generic pattern

---
-17-03-26

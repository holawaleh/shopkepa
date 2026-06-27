from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db import transaction

from core.models import User, Branch, UserBranch
from core.permissions import IsOwner, IsManagerOrAbove
from core.utils import log_audit, get_client_ip
from .serializers import (
    StaffSerializer, CreateStaffSerializer, UpdateStaffSerializer
)


class StaffListCreateView(APIView):

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsOwner()]
        return [IsManagerOrAbove()]

    def get(self, request):
        staff = User.objects.filter(
            business=request.user.business,
            is_deleted=False
        ).exclude(id=request.user.id).order_by('full_name')
        serializer = StaffSerializer(staff, many=True)
        return Response(serializer.data)

    @transaction.atomic
    def post(self, request):
        serializer = CreateStaffSerializer(
            data=request.data,
            context={'request': request}
        )
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data

        # Create staff user
        staff = User.objects.create_user(
            username=data['username'],
            password=data['password'],
            full_name=data['full_name'],
            phone_number=data['phone_number'],
            email=data['email'],
            business=request.user.business,
            role=data['role'],
            created_by=request.user,
        )

        # Assign to branches
        branches = Branch.objects.filter(
            id__in=data['branch_ids'],
            business=request.user.business
        )
        for branch in branches:
            UserBranch.objects.create(
                user=staff,
                branch=branch,
                business=request.user.business,
                created_by=request.user,
            )

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='CREATE',
            table_name='users',
            record_id=staff.id,
            new_values={
                'username': staff.username,
                'role': staff.role
            },
            ip_address=get_client_ip(request),
        )

        return Response(
            StaffSerializer(staff).data,
            status=status.HTTP_201_CREATED
        )


class StaffDetailView(APIView):

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsManagerOrAbove()]
        return [IsOwner()]

    def get_staff(self, request, user_id):
        try:
            return User.objects.get(
                id=user_id,
                business=request.user.business,
                is_deleted=False
            )
        except User.DoesNotExist:
            return None

    def get(self, request, user_id):
        staff = self.get_staff(request, user_id)
        if not staff:
            return Response(
                {'error': 'Staff member not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(StaffSerializer(staff).data)

    @transaction.atomic
    def patch(self, request, user_id):
        staff = self.get_staff(request, user_id)
        if not staff:
            return Response(
                {'error': 'Staff member not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if staff.role == 'owner':
            return Response(
                {'error': 'Cannot modify the business owner account.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = UpdateStaffSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data

        if 'full_name' in data:
            staff.full_name = data['full_name']
        if 'role' in data:
            staff.role = data['role']
        staff.save()

        # Update branch assignments if provided
        if 'branch_ids' in data:
            UserBranch.objects.filter(user=staff).delete()
            branches = Branch.objects.filter(
                id__in=data['branch_ids'],
                business=request.user.business
            )
            for branch in branches:
                UserBranch.objects.create(
                    user=staff,
                    branch=branch,
                    business=request.user.business,
                    created_by=request.user,
                )

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='UPDATE',
            table_name='users',
            record_id=staff.id,
            new_values=data,
            ip_address=get_client_ip(request),
        )

        return Response(StaffSerializer(staff).data)

    def delete(self, request, user_id):
        staff = self.get_staff(request, user_id)
        if not staff:
            return Response(
                {'error': 'Staff member not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if staff.role == 'owner':
            return Response(
                {'error': 'Cannot delete the business owner account.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        staff.is_deleted = True
        staff.deleted_at = timezone.now()
        staff.is_active  = False
        staff.save()

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='DELETE',
            table_name='users',
            record_id=staff.id,
            ip_address=get_client_ip(request),
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class ToggleStaffActiveView(APIView):
    permission_classes = [IsOwner]

    def patch(self, request, user_id):
        try:
            staff = User.objects.get(
                id=user_id,
                business=request.user.business,
                is_deleted=False
            )
        except User.DoesNotExist:
            return Response(
                {'error': 'Staff member not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if staff.id == request.user.id:
            return Response(
                {'error': 'You cannot deactivate your own account.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if staff.role == 'owner':
            return Response(
                {'error': 'Cannot deactivate the business owner.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        is_active = request.data.get('is_active')
        if is_active is None:
            return Response(
                {'error': 'is_active field is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        staff.is_active = is_active
        staff.save()

        action_text = 'activated' if is_active else 'deactivated'

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='DEACTIVATE',
            table_name='users',
            record_id=staff.id,
            new_values={'is_active': is_active},
            ip_address=get_client_ip(request),
        )

        return Response({
            'message': f'Staff member {action_text} successfully.',
            'is_active': staff.is_active,
        })
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from core.models import Branch
from core.permissions import IsOwner, IsManagerOrAbove
from core.utils import log_audit, get_client_ip
from .serializers import BranchSerializer, CreateBranchSerializer


class BranchListCreateView(APIView):

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsOwner()]
        return [IsManagerOrAbove()]

    def get(self, request):
        branches = Branch.objects.filter(
            business=request.user.business,
            is_deleted=False
        ).order_by('-is_main_branch', 'name')
        serializer = BranchSerializer(branches, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CreateBranchSerializer(
            data=request.data,
            context={'request': request}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        branch = serializer.save(
            business=request.user.business,
            created_by=request.user,
            is_main_branch=False,
        )

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='CREATE',
            table_name='branches',
            record_id=branch.id,
            new_values={'name': branch.name},
            ip_address=get_client_ip(request),
        )

        return Response(
            BranchSerializer(branch).data,
            status=status.HTTP_201_CREATED
        )


class BranchDetailView(APIView):

    def get_permissions(self):
        if self.request.method in ('PATCH', 'DELETE'):
            return [IsOwner()]
        return [IsManagerOrAbove()]

    def get_branch(self, request, branch_id):
        try:
            return Branch.objects.get(
                id=branch_id,
                business=request.user.business,
                is_deleted=False
            )
        except Branch.DoesNotExist:
            return None

    def get(self, request, branch_id):
        branch = self.get_branch(request, branch_id)
        if not branch:
            return Response({'error': 'Branch not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(BranchSerializer(branch).data)

    def patch(self, request, branch_id):
        branch = self.get_branch(request, branch_id)
        if not branch:
            return Response({'error': 'Branch not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = BranchSerializer(
            branch, data=request.data, partial=True
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        old_values = {'name': branch.name, 'is_active': branch.is_active}
        branch = serializer.save()

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='UPDATE',
            table_name='branches',
            record_id=branch.id,
            old_values=old_values,
            new_values={'name': branch.name, 'is_active': branch.is_active},
            ip_address=get_client_ip(request),
        )

        return Response(BranchSerializer(branch).data)

    def delete(self, request, branch_id):
        branch = self.get_branch(request, branch_id)
        if not branch:
            return Response({'error': 'Branch not found.'}, status=status.HTTP_404_NOT_FOUND)

        if branch.is_main_branch:
            return Response(
                {'error': 'Cannot delete the main branch.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        branch.is_deleted = True
        branch.deleted_at = timezone.now()
        branch.save()

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='DELETE',
            table_name='branches',
            record_id=branch.id,
            ip_address=get_client_ip(request),
        )

        return Response(status=status.HTTP_204_NO_CONTENT)